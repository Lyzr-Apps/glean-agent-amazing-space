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
    const { ragId, url } = body

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
          max_depth: 3,
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

    return NextResponse.json({
      success: true,
      message: 'Website crawled and trained successfully',
      url,
      pagesProcessed: crawlData.document_count || crawlData.pages || crawlData.chunks || 1,
      ragId,
      timestamp: new Date().toISOString(),
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
