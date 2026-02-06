/**
 * React hooks for marketplace operations
 */

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useMarketplaceStore } from '../marketplaceStore';
import { useGroupContext } from '@/contexts/GroupContext';
import { useAuthStore } from '@/stores/authStore';
import type {
  Listing,
  ListingType,
  ContactMethod,
  CoopProfile,
  GovernanceModel,
  Review,
  SkillExchange,
  ResourceShare,
  ResourceType,
  AvailabilitySlot,
  LocationValue,
} from '../types';

/**
 * Hook for listing CRUD operations
 */
export function useListings() {
  const { groupId } = useGroupContext();
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const addListing = useMarketplaceStore((s) => s.addListing);
  const updateListing = useMarketplaceStore((s) => s.updateListing);
  const deleteListing = useMarketplaceStore((s) => s.deleteListing);
  const getFilteredListings = useMarketplaceStore((s) => s.getFilteredListings);

  const listings = getFilteredListings(groupId);

  const createListing = useCallback(
    (data: {
      type: ListingType;
      title: string;
      description: string;
      price?: number;
      currency?: string;
      images?: string[];
      location?: LocationValue;
      availability?: string;
      tags?: string[];
      expiresAt?: number;
      contactMethod?: ContactMethod;
      coopId?: string;
    }) => {
      const now = Date.now();
      const listing: Listing = {
        _v: '1.0.0',
        id: nanoid(),
        groupId,
        type: data.type,
        title: data.title,
        description: data.description,
        price: data.price,
        currency: data.currency ?? 'USD',
        images: data.images ?? [],
        location: data.location,
        availability: data.availability,
        tags: data.tags ?? [],
        createdBy: currentIdentity?.publicKey ?? '',
        createdAt: now,
        updatedAt: now,
        expiresAt: data.expiresAt,
        status: 'active',
        coopId: data.coopId,
        contactMethod: data.contactMethod ?? 'dm',
      };
      addListing(listing);
      return listing;
    },
    [groupId, currentIdentity, addListing]
  );

  return { listings, createListing, updateListing, deleteListing };
}

/**
 * Hook for co-op profile operations
 */
export function useCoopProfiles() {
  const { groupId } = useGroupContext();
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const addCoopProfile = useMarketplaceStore((s) => s.addCoopProfile);
  const updateCoopProfile = useMarketplaceStore((s) => s.updateCoopProfile);
  const deleteCoopProfile = useMarketplaceStore((s) => s.deleteCoopProfile);
  const getCoopsByGroup = useMarketplaceStore((s) => s.getCoopsByGroup);
  const vouchForCoop = useMarketplaceStore((s) => s.vouchForCoop);

  const coops = getCoopsByGroup(groupId);

  const registerCoop = useCallback(
    (data: {
      name: string;
      description: string;
      memberCount: number;
      governanceModel: GovernanceModel;
      industry: string;
      location?: LocationValue;
      website?: string;
      image?: string;
    }) => {
      const now = Date.now();
      const coop: CoopProfile = {
        _v: '1.0.0',
        id: nanoid(),
        groupId,
        name: data.name,
        description: data.description,
        memberCount: data.memberCount,
        governanceModel: data.governanceModel,
        industry: data.industry,
        location: data.location,
        website: data.website,
        nostrPubkey: currentIdentity?.publicKey ?? '',
        verifiedBy: [],
        image: data.image,
        createdAt: now,
        updatedAt: now,
      };
      addCoopProfile(coop);
      return coop;
    },
    [groupId, currentIdentity, addCoopProfile]
  );

  const vouch = useCallback(
    (coopId: string) => {
      if (currentIdentity?.publicKey) {
        vouchForCoop(coopId, currentIdentity.publicKey);
      }
    },
    [currentIdentity, vouchForCoop]
  );

  return { coops, registerCoop, updateCoopProfile, deleteCoopProfile, vouch };
}

/**
 * Hook for review operations
 */
export function useReviews(listingId: string) {
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const addReview = useMarketplaceStore((s) => s.addReview);
  const deleteReview = useMarketplaceStore((s) => s.deleteReview);
  const getReviewsForListing = useMarketplaceStore((s) => s.getReviewsForListing);
  const getAverageRating = useMarketplaceStore((s) => s.getAverageRating);

  const reviews = getReviewsForListing(listingId);
  const averageRating = getAverageRating(listingId);

  const submitReview = useCallback(
    (rating: number, text: string) => {
      const review: Review = {
        _v: '1.0.0',
        id: nanoid(),
        listingId,
        reviewerPubkey: currentIdentity?.publicKey ?? '',
        rating,
        text,
        createdAt: Date.now(),
      };
      addReview(review);
      return review;
    },
    [listingId, currentIdentity, addReview]
  );

  return { reviews, averageRating, submitReview, deleteReview };
}

/**
 * Hook for skill exchange operations
 */
export function useSkillExchanges() {
  const { groupId } = useGroupContext();
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const addSkillExchange = useMarketplaceStore((s) => s.addSkillExchange);
  const updateSkillExchange = useMarketplaceStore((s) => s.updateSkillExchange);
  const deleteSkillExchange = useMarketplaceStore((s) => s.deleteSkillExchange);
  const getActiveSkillExchanges = useMarketplaceStore((s) => s.getActiveSkillExchanges);

  const exchanges = getActiveSkillExchanges(groupId);

  const createExchange = useCallback(
    (data: {
      offeredSkill: string;
      requestedSkill: string;
      availableHours: number;
      location?: LocationValue;
    }) => {
      const now = Date.now();
      const exchange: SkillExchange = {
        _v: '1.0.0',
        id: nanoid(),
        groupId,
        offeredSkill: data.offeredSkill,
        requestedSkill: data.requestedSkill,
        availableHours: data.availableHours,
        hourlyTimebank: 0,
        location: data.location,
        createdBy: currentIdentity?.publicKey ?? '',
        createdAt: now,
        updatedAt: now,
        status: 'active',
      };
      addSkillExchange(exchange);
      return exchange;
    },
    [groupId, currentIdentity, addSkillExchange]
  );

  return { exchanges, createExchange, updateSkillExchange, deleteSkillExchange };
}

/**
 * Hook for resource share operations
 */
export function useResourceShares() {
  const { groupId } = useGroupContext();
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const addResourceShare = useMarketplaceStore((s) => s.addResourceShare);
  const updateResourceShare = useMarketplaceStore((s) => s.updateResourceShare);
  const deleteResourceShare = useMarketplaceStore((s) => s.deleteResourceShare);
  const getAvailableResources = useMarketplaceStore((s) => s.getAvailableResources);

  const resources = getAvailableResources(groupId);

  const shareResource = useCallback(
    (data: {
      resourceType: ResourceType;
      name: string;
      description: string;
      availability: AvailabilitySlot[];
      location?: LocationValue;
      depositRequired: boolean;
      depositAmount?: number;
      depositCurrency?: string;
      images?: string[];
    }) => {
      const now = Date.now();
      const resource: ResourceShare = {
        _v: '1.0.0',
        id: nanoid(),
        groupId,
        resourceType: data.resourceType,
        name: data.name,
        description: data.description,
        availability: data.availability,
        location: data.location,
        depositRequired: data.depositRequired,
        depositAmount: data.depositAmount,
        depositCurrency: data.depositCurrency,
        images: data.images ?? [],
        createdBy: currentIdentity?.publicKey ?? '',
        createdAt: now,
        updatedAt: now,
        status: 'available',
      };
      addResourceShare(resource);
      return resource;
    },
    [groupId, currentIdentity, addResourceShare]
  );

  return { resources, shareResource, updateResourceShare, deleteResourceShare };
}
