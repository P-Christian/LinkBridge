// src/modules/matching-engine/index.ts

export * from "./types/matchTypes";
export * from "./types/profileTypes";
export * from "./types/evaluatorTypes";
export * from "./config/scoringConfig";

export * from "./normalizers/textNormalizer";
export * from "./normalizers/tokenExtractor";
export * from "./normalizers/profileNormalizer";
export * from "./normalizers/titleNormalizer";
export * from "./normalizers/skillNormalizer";
export * from "./normalizers/queryNormalizer";

export * from "./retrieval/queryAnalyzer";
export * from "./retrieval/taxonomyResolver";
export * from "./retrieval/fuzzyMatcher";
export * from "./retrieval/tokenMatcher";
export * from "./retrieval/schoolMatcher";
export * from "./retrieval/nameMatcher";
export * from "./retrieval/candidateRetriever";
export * from "./taxonomy";

export * from "./engine/matcher";
