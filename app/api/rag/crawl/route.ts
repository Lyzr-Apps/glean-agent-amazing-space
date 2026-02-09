import { NextRequest, NextResponse } from 'next/server'

const LYZR_RAG_BASE_URL = 'https://rag-prod.studio.lyzr.ai/v3'
const LYZR_API_KEY = process.env.LYZR_API_KEY || ''

// POST - Crawl a website and train the knowledge base
export async function POST(request: NextRequest) {
  try {
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'LYZR_API_KEY not configured on server',
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { ragId, url, maxDepth } = body

    if (!ragId || !url) {
      return NextResponse.json(
        {
          success: false,
          error: 'ragId and url are required',
        },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid URL format. Please provide a valid URL (e.g., https://example.com)',
        },
        { status: 400 }
      )
    }

    // Call Lyzr RAG website crawl endpoint
    const crawlResponse = await fetch(
      `${LYZR_RAG_BASE_URL}/train/website/?rag_id=${encodeURIComponent(ragId)}`,
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': LYZR_API_KEY,
        },
        body: JSON.stringify({
          urls: [url],
          max_depth: typeof maxDepth === 'number' && maxDepth >= 1 && maxDepth <= 10 ? maxDepth : 5,
        }),
      }
    )

    if (!crawlResponse.ok) {
      const errorText = await crawlResponse.text()
      return NextResponse.json(
        {
          success: false,
          error: `Website crawl failed: ${crawlResponse.status}`,
          details: errorText,
        },
        { status: crawlResponse.status }
      )
    }

    const crawlData = await crawlResponse.json()

    // Log the full response so we can see the actual structure
    console.log('[Crawl API] Full Lyzr response:', JSON.stringify(crawlData, null, 2))

    // Attempt to extract page/document count from various possible fields
    const extractCount = (data: any): number => {
      if (!data || typeof data !== 'object') return 0
      // Check common field names at top level
      const candidates = [
        data.document_count,
        data.num_documents,
        data.total_documents,
        data.pages,
        data.pages_processed,
        data.num_pages,
        data.total_pages,
        data.chunks,
        data.num_chunks,
        data.total_chunks,
        data.count,
        data.total,
        data.num_nodes,
        data.documents_processed,
      ]
      for (const val of candidates) {
        if (typeof val === 'number' && val > 0) return val
      }
      // Check if response is an array (some APIs return array of processed docs)
      if (Array.isArray(data)) return data.length
      // Check nested "data" or "result" objects
      if (data.data && typeof data.data === 'object') {
        const nested = extractCount(data.data)
        if (nested > 0) return nested
      }
      if (data.result && typeof data.result === 'object') {
        const nested = extractCount(data.result)
        if (nested > 0) return nested
      }
      return 0
    }

    const pagesProcessed = extractCount(crawlData) || 1

    return NextResponse.json({
      success: true,
      message: 'Website crawled and trained successfully',
      url,
      pagesProcessed,
      ragId,
      timestamp: new Date().toISOString(),
      rawResponse: crawlData,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Server error during crawl',
      },
      { status: 500 }
    )
  }
}
