import { AidItem, RideShare, MatchResult } from '../types'

/**
 * Calculate match score between a request and an offer
 */
export function calculateMatchScore(request: AidItem, offer: AidItem): MatchResult {
  let score = 0
  const reasons: string[] = []

  // Must be opposite types
  if (request.type === offer.type) {
    return { requestId: request.id, offerId: offer.id, score: 0, reasons: ['Same type'] }
  }

  // Category match (40 points)
  if (request.category === offer.category) {
    score += 40
    reasons.push('Category match')
  }

  // Location proximity (20 points)
  // Simplified: exact match for now, TODO: implement geolocation distance
  if (request.location && offer.location) {
    if (request.location.toLowerCase() === offer.location.toLowerCase()) {
      score += 20
      reasons.push('Same location')
    } else if (
      request.location.toLowerCase().includes(offer.location.toLowerCase()) ||
      offer.location.toLowerCase().includes(request.location.toLowerCase())
    ) {
      score += 10
      reasons.push('Similar location')
    }
  }

  // Urgency alignment (15 points)
  const urgencyScores = { critical: 4, high: 3, medium: 2, low: 1 }
  const requestUrgency = urgencyScores[request.urgency]
  const offerUrgency = urgencyScores[offer.urgency]

  if (requestUrgency === offerUrgency) {
    score += 15
    reasons.push('Urgency alignment')
  } else if (Math.abs(requestUrgency - offerUrgency) === 1) {
    score += 8
    reasons.push('Close urgency match')
  }

  // Timing (10 points)
  // Check if offer hasn't expired and can meet request timeline
  const now = Date.now()
  if (offer.expiresAt && offer.expiresAt > now) {
    if (request.expiresAt && offer.expiresAt >= request.expiresAt) {
      score += 10
      reasons.push('Can meet timeline')
    } else if (!request.expiresAt) {
      score += 5
      reasons.push('Offer available')
    }
  } else if (!offer.expiresAt) {
    score += 10
    reasons.push('No expiration')
  }

  // Quantity match (10 points)
  if (request.quantity && offer.quantity) {
    if (offer.quantity >= request.quantity) {
      score += 10
      reasons.push('Sufficient quantity')
    } else {
      const ratio = offer.quantity / request.quantity
      score += Math.floor(ratio * 10)
      reasons.push('Partial quantity match')
    }
  }

  // Tag overlap (5 points)
  const requestTags = new Set(request.tags)
  const offerTags = new Set(offer.tags)
  const commonTags = [...requestTags].filter((tag) => offerTags.has(tag))
  if (commonTags.length > 0) {
    score += Math.min(commonTags.length * 2, 5)
    reasons.push(`${commonTags.length} tag(s) match`)
  }

  return {
    requestId: request.id,
    offerId: offer.id,
    score: Math.min(score, 100),
    reasons,
  }
}

/**
 * Find best matches for a request from a list of offers
 */
export function findBestMatches(
  request: AidItem,
  offers: AidItem[],
  minScore = 40,
  maxResults = 5
): MatchResult[] {
  const matches = offers
    .filter((offer) => offer.status === 'open')
    .map((offer) => calculateMatchScore(request, offer))
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)

  return matches
}

/**
 * Calculate route similarity score for ride shares
 */
function calculateRouteScore(
  requestOrigin: string,
  requestDest: string,
  offerOrigin: string,
  offerDest: string
): number {
  let score = 0

  // Exact origin match (50 points)
  if (requestOrigin.toLowerCase() === offerOrigin.toLowerCase()) {
    score += 50
  } else if (
    requestOrigin.toLowerCase().includes(offerOrigin.toLowerCase()) ||
    offerOrigin.toLowerCase().includes(requestOrigin.toLowerCase())
  ) {
    score += 25
  }

  // Exact destination match (50 points)
  if (requestDest.toLowerCase() === offerDest.toLowerCase()) {
    score += 50
  } else if (
    requestDest.toLowerCase().includes(offerDest.toLowerCase()) ||
    offerDest.toLowerCase().includes(requestDest.toLowerCase())
  ) {
    score += 25
  }

  return score
}

/**
 * Calculate time compatibility score
 */
function calculateTimeScore(
  requestTime: number,
  requestFlexibility: number,
  offerTime: number,
  offerFlexibility: number
): number {
  const timeDiff = Math.abs(requestTime - offerTime) / (1000 * 60) // minutes
  const totalFlexibility = requestFlexibility + offerFlexibility

  if (timeDiff === 0) {
    return 100
  } else if (timeDiff <= totalFlexibility) {
    return Math.max(0, 100 - (timeDiff / totalFlexibility) * 50)
  } else {
    // Penalize beyond flexibility window
    const excessMinutes = timeDiff - totalFlexibility
    return Math.max(0, 50 - excessMinutes)
  }
}

/**
 * Match ride share requests with offers
 */
export function matchRideShares(
  request: RideShare,
  offers: RideShare[],
  minScore = 50
): MatchResult[] {
  const matches = offers
    .filter((offer) => offer.status === 'open' && offer.type === 'offer')
    .map((offer) => {
      const routeScore = calculateRouteScore(
        request.origin,
        request.destination,
        offer.origin,
        offer.destination
      )

      const timeScore = calculateTimeScore(
        request.departureTime,
        request.flexibility,
        offer.departureTime,
        offer.flexibility
      )

      // Seats availability (if applicable)
      let seatsScore = 100
      if (offer.seats && request.needsSeats) {
        if (offer.seats >= request.needsSeats) {
          seatsScore = 100
        } else {
          seatsScore = (offer.seats / request.needsSeats) * 100
        }
      }

      // Weighted scoring
      const totalScore = routeScore * 0.5 + timeScore * 0.3 + seatsScore * 0.2

      const reasons: string[] = []
      if (routeScore >= 90) reasons.push('Excellent route match')
      else if (routeScore >= 50) reasons.push('Good route match')

      if (timeScore >= 80) reasons.push('Perfect timing')
      else if (timeScore >= 50) reasons.push('Compatible timing')

      if (seatsScore === 100) reasons.push('Seats available')

      return {
        requestId: request.id,
        offerId: offer.id,
        score: Math.round(totalScore),
        reasons,
      }
    })
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score)

  return matches
}

/**
 * Get match quality label
 */
export function getMatchQualityLabel(score: number): string {
  if (score >= 90) return 'Excellent Match'
  if (score >= 75) return 'Great Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Fair Match'
  return 'Poor Match'
}

/**
 * Get match quality color
 */
export function getMatchQualityColor(score: number): string {
  if (score >= 90) return 'text-green-600'
  if (score >= 75) return 'text-green-500'
  if (score >= 60) return 'text-yellow-500'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-500'
}
