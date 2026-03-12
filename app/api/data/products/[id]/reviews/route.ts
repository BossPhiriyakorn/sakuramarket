import { NextResponse } from "next/server";
import { getProductReviews, getProductRatingSummary, getProductSoldCount } from "@/lib/api/dbStore";

/** สาธารณะ: รายการรีวิวสินค้า + สรุปดาว + ยอดขาย */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "ไม่ระบุสินค้า", reviews: [], avg_rating: 0, review_count: 0, sold_count: 0 }, { status: 400 });
    }
    const [reviews, summary, sold_count] = await Promise.all([
      getProductReviews(productId),
      getProductRatingSummary(productId),
      getProductSoldCount(productId),
    ]);
    return NextResponse.json({
      reviews,
      avg_rating: summary.avg_rating,
      review_count: summary.review_count,
      sold_count,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), reviews: [], avg_rating: 0, review_count: 0, sold_count: 0 }, { status: 500 });
  }
}
