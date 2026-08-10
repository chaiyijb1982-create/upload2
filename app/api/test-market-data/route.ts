import {
  getChinaFundPrice,
  getFinnhubPrice,
  getStockEventsPrice,
  getUsdCny,
} from "@/lib/market-data";


export const dynamic =
  "force-dynamic";


export async function GET() {

  const result = {

    china:
      await getChinaFundPrice(
        "015736"
      ),

    us:
      await getFinnhubPrice(
        "VOO"
      ),

    stockevents:
      await getStockEventsPrice(
        "HK0000000000"
      ),

    usdcny:
      await getUsdCny(),

  };


  return Response.json(
    result
  );

}