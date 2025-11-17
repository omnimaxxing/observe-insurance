import { Index } from "@upstash/vector";

interface SearchKnowledgeBaseParams {
  query: string;
}

export async function searchKnowledgeBase({ query }: SearchKnowledgeBaseParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: searchKnowledgeBase`);
  console.log(`📥 Query: ${query}`);

  try {
    const index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL!,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    });

    const results = await index.query({
      data: query,
      topK: 3,
      includeMetadata: true,
    });

    if (results.length === 0) {
      console.log(`❌ No knowledge base results found`);
      console.log(`${"=".repeat(80)}\n`);
      
      return {
        success: false,
        error: "NO_RESULTS",
        query,
        resultsFound: 0,
        message: "No relevant information found in knowledge base",
      };
    }

    const topResult = results[0];
    const metadata = topResult.metadata as any;
    const content = metadata?.content || topResult.data;

    console.log(`✅ Found result:`, {
      title: metadata?.title,
      score: topResult.score,
    });
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: true,
      resultsFound: results.length,
      query,
      articleTitle: metadata?.title || "FAQ Answer",
      content,
      relevanceScore: topResult.score,
      confidence: topResult.score > 0.8 ? "high" : topResult.score > 0.6 ? "medium" : "low",
      additionalResults: results.slice(1, 3).map(r => ({
        title: (r.metadata as any)?.title,
        score: r.score,
      })),
      message: "Knowledge base information retrieved successfully",
    };
  } catch (error) {
    console.error("❌ Error searching knowledge base:", error);
    console.log(`${"=".repeat(80)}\n`);
    
    return {
      success: false,
      error: "SEARCH_ERROR",
      query,
      errorDetails: error instanceof Error ? error.message : "Unknown error",
      message: "Error accessing knowledge base",
    };
  }
}
