"use client";


interface Props {

  holdings?: any[];

}


export default function ProfitRanking({

  holdings = []

}: Props){


const data =

[...(holdings || [])]

.sort(

(a,b)=>

Number(b.profit_rate || 0)

-

Number(a.profit_rate || 0)

);



const winners =

data.slice(0,5);



const losers =

[...(holdings || [])]

.sort(

(a,b)=>

Number(a.profit_rate || 0)

-

Number(b.profit_rate || 0)

)

.slice(0,5);





return (

<div

className="
grid
grid-cols-1
md:grid-cols-2
gap-6
"

>



{/* Winners */}

<div

className="
bg-white
rounded-2xl
shadow
p-8
"

>


<h2

className="
text-2xl
font-bold
mb-6
"

>

🏆 Top Winners

</h2>



<div className="space-y-4">


{

winners.length === 0 ? (

<p className="text-gray-400">

暂无数据

</p>


)

:

winners.map((item:any,index:number)=>(


<div

key={index}

className="
flex
justify-between
border-b
pb-3
"

>


<div>

<div className="font-bold">

{item.name}

</div>


<div className="text-sm text-gray-500">

{item.market}

</div>


</div>



<div

className="
font-bold
text-green-600
"

>

+

{(

Number(item.profit_rate || 0)

*

100

).toFixed(2)}

%

</div>


</div>


))


}


</div>


</div>










{/* Losers */}



<div

className="
bg-white
rounded-2xl
shadow
p-8
"

>


<h2

className="
text-2xl
font-bold
mb-6
"

>

📉 Needs Attention

</h2>



<div className="space-y-4">


{

losers.length === 0 ? (

<p className="text-gray-400">

暂无数据

</p>


)

:

losers.map((item:any,index:number)=>(


<div

key={index}

className="
flex
justify-between
border-b
pb-3
"

>


<div>

<div className="font-bold">

{item.name}

</div>


<div className="text-sm text-gray-500">

{item.market}

</div>


</div>



<div

className={

`

font-bold

${

Number(item.profit_rate)>=0

?

"text-green-600"

:

"text-red-600"

}

`

}

>


{

Number(item.profit_rate)>=0

?

"+"

:

""

}



{

(

Number(item.profit_rate || 0)

*

100

).toFixed(2)

}

%

</div>


</div>


))


}


</div>


</div>




</div>


);


}