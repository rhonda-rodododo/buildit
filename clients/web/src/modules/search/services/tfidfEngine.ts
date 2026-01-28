/**
 * TF-IDF Engine Service
 * Provides semantic search capabilities using term frequency-inverse document frequency
 */

import type { SearchDocument, SparseVector, DocumentStats, TermFrequency } from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Stop words to exclude from TF-IDF calculations
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'she',
  'that', 'the', 'they', 'to', 'was', 'were', 'which', 'with',
  'you', 'your', 'this', 'these', 'those', 'i', 'me', 'my', 'we',
  'our', 'will', 'would', 'could', 'should', 'can', 'may', 'have',
  'had', 'do', 'does', 'did', 'been', 'being', 'am', 'if', 'so',
  'but', 'not', 'no', 'than', 'then', 'there', 'here', 'when',
  'where', 'what', 'who', 'how', 'why', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only',
]);

/**
 * Minimum term length to include
 */
const MIN_TERM_LENGTH = 2;

/**
 * Maximum vocabulary size
 */
const MAX_VOCABULARY_SIZE = 50000;

// ============================================================================
// TF-IDF Engine Class
// ============================================================================

export class TFIDFEngine {
  private vocabulary: Map<string, number> = new Map();  // term -> index
  private reverseVocab: Map<number, string> = new Map(); // index -> term
  private documentFrequency: Map<number, number> = new Map();  // term index -> doc count
  private totalDocuments: number = 0;
  private totalTermsSum: number = 0;
  private nextTermIndex: number = 0;

  /**
   * Get vocabulary size
   */
  get vocabularySize(): number {
    return this.vocabulary.size;
  }

  /**
   * Get total documents indexed
   */
  get documentCount(): number {
    return this.totalDocuments;
  }

  /**
   * Get document statistics
   */
  getStats(): DocumentStats {
    const df: Record<string, number> = {};
    for (const [idx, count] of this.documentFrequency.entries()) {
      const term = this.reverseVocab.get(idx);
      if (term) {
        df[term] = count;
      }
    }

    return {
      totalDocuments: this.totalDocuments,
      documentFrequency: df,
      avgDocLength: this.totalDocuments > 0 ? this.totalTermsSum / this.totalDocuments : 0,
    };
  }

  /**
   * Tokenize text into terms
   */
  tokenize(text: string): string[] {
    if (!text) return [];

    return text
      .toLowerCase()
      // Split on non-alphanumeric characters
      .split(/[^a-z0-9]+/)
      // Filter out stop words and short terms
      .filter((term) => term.length >= MIN_TERM_LENGTH && !STOP_WORDS.has(term))
      // Basic stemming
      .map((term) => this.stem(term));
  }

  /**
   * Basic Porter-like stemmer
   */
  private stem(word: string): string {
    // Remove common suffixes
    return word
      .replace(/ies$/, 'i')
      .replace(/es$/, '')
      .replace(/s$/, '')
      .replace(/ing$/, '')
      .replace(/ed$/, '')
      .replace(/ly$/, '')
      .replace(/ment$/, '')
      .replace(/tion$/, 't')
      .replace(/ness$/, '');
  }

  /**
   * Get or create term index
   */
  private getTermIndex(term: string, create: boolean = false): number | undefined {
    let index = this.vocabulary.get(term);

    if (index === undefined && create) {
      if (this.vocabulary.size >= MAX_VOCABULARY_SIZE) {
        // Vocabulary is full, don't add new terms
        return undefined;
      }
      index = this.nextTermIndex++;
      this.vocabulary.set(term, index);
      this.reverseVocab.set(index, term);
    }

    return index;
  }

  /**
   * Compute term frequencies for a document
   */
  computeTermFrequencies(text: string): TermFrequency[] {
    const tokens = this.tokenize(text);
    const counts: Map<string, number> = new Map();

    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    const totalTerms = tokens.length;
    const frequencies: TermFrequency[] = [];

    for (const [term, count] of counts.entries()) {
      frequencies.push({
        term,
        count,
        frequency: count / totalTerms,
      });
    }

    return frequencies;
  }

  /**
   * Build TF-IDF vector for a document
   */
  buildVector(doc: SearchDocument): SparseVector {
    // Combine all searchable text
    const text = [
      doc.title,
      doc.title,  // Double-weight title
      doc.content,
      doc.tags.join(' '),
    ].join(' ');

    const tokens = this.tokenize(text);
    const termCounts: Map<number, number> = new Map();
    const termsInDoc: Set<number> = new Set();

    // Count term occurrences
    for (const token of tokens) {
      const idx = this.getTermIndex(token, true);
      if (idx !== undefined) {
        termCounts.set(idx, (termCounts.get(idx) || 0) + 1);
        termsInDoc.add(idx);
      }
    }

    const totalTerms = tokens.length;
    const vector: SparseVector = {};

    // Compute TF-IDF weights
    for (const [termIdx, count] of termCounts.entries()) {
      // Term frequency: count / total terms in document
      const tf = count / totalTerms;

      // Inverse document frequency: log(N / (df + 1))
      const df = this.documentFrequency.get(termIdx) || 0;
      const idf = Math.log((this.totalDocuments + 1) / (df + 1)) + 1;

      // TF-IDF score
      vector[termIdx] = tf * idf;
    }

    return vector;
  }

  /**
   * Add a document to the corpus (updates document frequencies)
   */
  addDocument(doc: SearchDocument): SparseVector {
    const vector = this.buildVector(doc);

    // Update document frequencies
    for (const termIdx of Object.keys(vector).map(Number)) {
      this.documentFrequency.set(
        termIdx,
        (this.documentFrequency.get(termIdx) || 0) + 1
      );
    }

    this.totalDocuments++;
    this.totalTermsSum += Object.keys(vector).length;

    return vector;
  }

  /**
   * Remove a document from the corpus
   */
  removeDocument(vector: SparseVector): void {
    if (this.totalDocuments === 0) return;

    // Decrement document frequencies
    for (const termIdx of Object.keys(vector).map(Number)) {
      const currentDf = this.documentFrequency.get(termIdx) || 0;
      if (currentDf > 1) {
        this.documentFrequency.set(termIdx, currentDf - 1);
      } else {
        this.documentFrequency.delete(termIdx);
      }
    }

    this.totalDocuments--;
    this.totalTermsSum -= Object.keys(vector).length;
  }

  /**
   * Compute TF-IDF vector for a query
   */
  buildQueryVector(query: string): SparseVector {
    const tokens = this.tokenize(query);
    const termCounts: Map<number, number> = new Map();

    for (const token of tokens) {
      // Don't create new terms for query - only match existing vocabulary
      const idx = this.getTermIndex(token, false);
      if (idx !== undefined) {
        termCounts.set(idx, (termCounts.get(idx) || 0) + 1);
      }
    }

    const totalTerms = tokens.length || 1;
    const vector: SparseVector = {};

    for (const [termIdx, count] of termCounts.entries()) {
      const tf = count / totalTerms;
      const df = this.documentFrequency.get(termIdx) || 0;
      const idf = Math.log((this.totalDocuments + 1) / (df + 1)) + 1;
      vector[termIdx] = tf * idf;
    }

    return vector;
  }

  /**
   * Compute cosine similarity between two sparse vectors
   */
  cosineSimilarity(vecA: SparseVector, vecB: SparseVector): number {
    // Dot product
    let dotProduct = 0;
    for (const [idx, weightA] of Object.entries(vecA)) {
      const weightB = vecB[Number(idx)];
      if (weightB !== undefined) {
        dotProduct += weightA * weightB;
      }
    }

    // Magnitudes
    let magA = 0;
    for (const weight of Object.values(vecA)) {
      magA += weight * weight;
    }
    magA = Math.sqrt(magA);

    let magB = 0;
    for (const weight of Object.values(vecB)) {
      magB += weight * weight;
    }
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;

    return dotProduct / (magA * magB);
  }

  /**
   * Find similar documents using TF-IDF vectors
   */
  findSimilar(
    queryVector: SparseVector,
    documentVectors: Array<{ id: string; vector: SparseVector }>,
    limit: number = 10,
    minSimilarity: number = 0.1
  ): Array<{ id: string; similarity: number }> {
    const results: Array<{ id: string; similarity: number }> = [];

    for (const { id, vector } of documentVectors) {
      const similarity = this.cosineSimilarity(queryVector, vector);
      if (similarity >= minSimilarity) {
        results.push({ id, similarity });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  /**
   * Get top terms from a vector
   */
  getTopTerms(vector: SparseVector, limit: number = 10): Array<{ term: string; weight: number }> {
    const terms: Array<{ term: string; weight: number }> = [];

    for (const [idx, weight] of Object.entries(vector)) {
      const term = this.reverseVocab.get(Number(idx));
      if (term) {
        terms.push({ term, weight });
      }
    }

    terms.sort((a, b) => b.weight - a.weight);
    return terms.slice(0, limit);
  }

  /**
   * Clear the engine state
   */
  clear(): void {
    this.vocabulary.clear();
    this.reverseVocab.clear();
    this.documentFrequency.clear();
    this.totalDocuments = 0;
    this.totalTermsSum = 0;
    this.nextTermIndex = 0;
  }

  /**
   * Export engine state for persistence
   */
  exportState(): string {
    return JSON.stringify({
      vocabulary: Array.from(this.vocabulary.entries()),
      documentFrequency: Array.from(this.documentFrequency.entries()),
      totalDocuments: this.totalDocuments,
      totalTermsSum: this.totalTermsSum,
      nextTermIndex: this.nextTermIndex,
    });
  }

  /**
   * Import engine state
   */
  importState(json: string): void {
    const data = JSON.parse(json);

    this.vocabulary = new Map(data.vocabulary);
    this.reverseVocab = new Map(
      data.vocabulary.map(([term, idx]: [string, number]) => [idx, term])
    );
    this.documentFrequency = new Map(data.documentFrequency);
    this.totalDocuments = data.totalDocuments;
    this.totalTermsSum = data.totalTermsSum;
    this.nextTermIndex = data.nextTermIndex;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: TFIDFEngine | null = null;

/**
 * Get the singleton TF-IDF engine instance
 */
export function getTFIDFEngine(): TFIDFEngine {
  if (!instance) {
    instance = new TFIDFEngine();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetTFIDFEngine(): void {
  if (instance) {
    instance.clear();
  }
  instance = null;
}
