export interface ForecastItem {

  year:number;

  asset:number;

  contribution:number;

}



const contributions:any = {


  2027:724000,

  2028:614000,

  2029:614000,

  2030:614000,

  2031:614000,

  2032:614000,

  2033:351000,

  2034:259000,

  2035:259000,

  2036:259000,

  2037:259000,

  2038:129000,

  2039:39000,

  2040:39000,

  2041:39000,

  2042:39000

};





export function calculateForecast(){



  const startAsset = 1595984;



  const yearlyRate = 0.05;



  let asset = startAsset;



  const result:ForecastItem[]=[];




  for(
    let year=2027;
    year<=2042;
    year++
  ){



    const contribution =
      contributions[year] || 0;



    asset =
      (
        asset
        +
        contribution
      )
      *
      (1 + yearlyRate);




    result.push({

      year,

      asset:
        Math.round(asset),

      contribution


    });



  }




  return result;



}