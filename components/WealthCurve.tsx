import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";


interface Props {
  data: any[];
}


export default function WealthCurve({
  data
}: Props) {


  return (

    <div
      style={{
        background:"#ffffff",
        borderRadius:"16px",
        padding:"20px",
        marginTop:"20px"
      }}
    >

      <h2>
        📈 财富曲线
      </h2>


      <ResponsiveContainer
        width="100%"
        height={320}
      >

        <LineChart data={data}>

          <CartesianGrid
            strokeDasharray="3 3"
          />


          <XAxis
            dataKey="snapshot_date"
          />


          <YAxis
            tickFormatter={
              (v)=>
              `${(v/10000).toFixed(0)}万`
            }
          />


          <Tooltip
            formatter={
              (v:any)=>
              `${Number(v).toLocaleString()} 元`
            }
          />


          <Line
            type="monotone"
            dataKey="total_asset"
            strokeWidth={3}
          />


        </LineChart>


      </ResponsiveContainer>


    </div>

  );
}