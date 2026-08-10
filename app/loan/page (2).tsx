"use client";


import {

useEffect,

useState

} from "react";


import TopBar from "@/components/TopBar";


import {

getLoans,

addLoan,

updateLoan,

deleteLoan

} from "@/lib/loan";




// =====================================================
// 输入组件
// =====================================================

function InputBox({

title,

tip,

value,

setValue

}:any){


return (

<div

className="
mb-4
"

>


<label

className="
font-medium
"

>

{title}

</label>



<p

className="
text-xs
text-gray-400
"

>

{tip}

</p>



<input

className="
border
p-3
rounded
w-full
mt-1
"

type="number"

value={

value ?? ""

}

onChange={e=>

setValue(

Number(
e.target.value
)

)

}

/>



</div>


)

}









// =====================================================
// 金额格式
// =====================================================

function money(

value:number

){


const n=

Number(value)||0;



if(n>=100000000){


return (

"¥"

+

(

n/100000000

)

.toFixed(2)

+

"亿"

)

}



if(n>=10000){


return (

"¥"

+

(

n/10000

)

.toFixed(1)

+

"万"

)

}



return (

"¥"

+

n.toLocaleString()

)


}




function calculateLoanInterest(
  loan:any
){


  if(
    loan.type !== "保险贷款"
  ){

    return 0;

  }



  if(
    !loan.start_date
  ){

    return 0;

  }



  const start =
    new Date(
      loan.start_date
    );



  const now =
    new Date();



  const days =

    Math.max(

      0,

      Math.floor(

        (

          now.getTime()

          -

          start.getTime()

        )

        /

        (

          1000 *

          60 *

          60 *

          24

        )

      )

    );




  const interest =


    Number(
      loan.remaining_amount || 0
    )

    *

    (

      Number(
        loan.interest_rate || 0
      )

      /

      100

    )

    *

    days

    /

    365;



  return interest;


}




export default function LoanPage(){



const [

loans,

setLoans

]=useState<any[]>([]);



const [

editing,

setEditing

]=useState<any>(null);



const [

loading,

setLoading

]=useState(true);








async function load(){


const data=

await getLoans();


setLoans(data);


setLoading(false);


}





useEffect(()=>{


load();


},[]);









const totalBalance=

loans.reduce(

(

sum:number,

item:any

)=>

sum+

Number(
item.remaining_amount||0
),

0

);






const monthlyPayment=

loans.reduce(

(

sum:number,

item:any

)=>

sum+

Number(
item.monthly_payment||0
),

0

);










function createNew(){


setEditing({


name:"",


type:"房贷",


loan_mode:"fixed",


owner:"家庭",


original_amount:0,


remaining_amount:0,


credit_limit:0,


interest_rate:0,


monthly_payment:0,


start_date:"",


end_date:"",


renewable:false,


renew_period_months:6,


include_financial_freedom:false,


note:""


});


}







async function save(){


if(editing.id){


await updateLoan(

editing.id,

editing

);


}else{


await addLoan(

editing

);


}



setEditing(null);


load();


}







async function remove(id:string){


if(confirm("确定删除?")){


await deleteLoan(id);


load();


}


}

return (

<>


<TopBar

title="贷款管理"

/>





<main

className="
p-8
max-w-[1400px]
mx-auto
space-y-8
"

>





<h1

className="
text-3xl
font-bold
"

>

💳 家庭贷款管理

</h1>



<p

className="
text-gray-500
"

>

管理房贷、信用卡分期、保险贷款、银行信用贷

</p>









{/* =====================
汇总卡片
===================== */}



<section

className="
grid
grid-cols-1
md:grid-cols-3
gap-6
"

>



<div

className="
bg-white
border
rounded-2xl
p-6
"

>


<div

className="
text-gray-500
"

>

当前家庭总负债

</div>



<div

className="
text-3xl
font-bold
mt-3
"

>

{

money(
totalBalance
)

}

</div>


</div>








<div

className="
bg-white
border
rounded-2xl
p-6
"

>


<div

className="
text-gray-500
"

>

固定月供压力

</div>



<div

className="
text-3xl
font-bold
mt-3
"

>

{

money(
monthlyPayment
)

}

</div>


</div>









<div

className="
bg-white
border
rounded-2xl
p-6
cursor-pointer
hover:bg-gray-50
"

onClick={createNew}

>


<div

className="
text-gray-500
"

>

新增贷款

</div>



<div

className="
text-3xl
font-bold
text-blue-600
mt-3
"

>

＋

</div>


</div>



</section>









{/* =====================
贷款列表
===================== */}



<section

className="
bg-white
border
rounded-2xl
p-6
"

>



<h2

className="
text-xl
font-bold
mb-5
"

>

📋 贷款明细

</h2>






{

loading

?


<div>

加载中...

</div>


:


<table

className="
w-full
text-sm
"

>


<thead>


<tr

className="
border-b
text-gray-500
"

>


<th className="p-3 text-left">

名称

</th>



<th className="p-3 text-left">

类型

</th>



<th className="p-3 text-left">

模式

</th>




<th className="p-3 text-right">

余额

</th>



<th className="p-3 text-right">

利率

</th>

<th className="p-3 text-right">

累计利息

</th>



<th className="p-3 text-right">

月供

</th>




<th className="p-3">

Financial Freedom

</th>




<th className="p-3">

操作

</th>



</tr>


</thead>





<tbody>



{

loans.map(

(item:any)=>(


<tr

key={item.id}

className="
border-b
"

>



<td

className="
p-3
"

>

{

item.name

}

</td>







<td

className="
p-3
"

>

{

item.type

}

</td>








<td

className="
p-3
"

>


{

item.loan_mode==="fixed"

?

"固定还款"

:

item.loan_mode==="revolving"

?

"循环额度"

:

"期限循环"

}


</td>







<td

className="
p-3
text-right
"

>

{

money(
item.remaining_amount
)

}

</td>







<td

className="
p-3
text-right
"

>

{

item.interest_rate

}

%

</td>

<td

className="
p-3
text-right
"

>

{

item.type==="保险贷款"

?

money(
calculateLoanInterest(item)
)

:

"-"

}

</td>




<td

className="
p-3
text-right
"

>

{

money(
item.monthly_payment
)

}

</td>








<td

className="
p-3
text-center
"

>

{

item.include_financial_freedom

?

"✅"

:

"❌"

}


</td>






<td

className="
p-3
text-center
space-x-3
"

>


<button

className="
text-blue-600
"

onClick={

()=>setEditing(item)

}

>

编辑

</button>





<button

className="
text-red-600
"

onClick={

()=>remove(item.id)

}

>

删除

</button>



</td>






</tr>


)


)



}



</tbody>



</table>


}



</section>





{/* =====================
新增 / 编辑窗口
===================== */}


{

editing &&


<div

className="
fixed
inset-0
bg-black/30
flex
items-center
justify-center
z-50
"

>


<div

className="
bg-white
rounded-2xl
p-8
w-[650px]
max-h-[90vh]
overflow-y-auto
"

>



<h2

className="
text-2xl
font-bold
mb-6
"

>

{

editing.id

?

"编辑贷款"

:

"新增贷款"

}


</h2>







{/* 名称 */}


<label>

贷款名称

<p className="
text-xs
text-gray-400
mb-1
">

例如：

上海房贷 / 平安保险贷款 / 招商银行信用贷

</p>



<input

className="
border
p-3
rounded
w-full
mb-5
"

value={editing.name}

onChange={e=>

setEditing({

...editing,

name:e.target.value

})

}

/>


</label>








{/* 类型 */}

<label>


贷款类型


<select

className="
border
p-3
rounded
w-full
mb-5
"

value={editing.type}

onChange={e=>{


const type=e.target.value;


let mode="fixed";



if(type==="保险贷款"){

mode="term_revolving";

}


if(type==="银行信用贷"){

mode="revolving";

}



setEditing({

...editing,

type,

loan_mode:mode

});


}}


>


<option>

房贷

</option>


<option>

信用卡分期

</option>


<option>

保险贷款

</option>


<option>

银行信用贷

</option>


<option>

其他

</option>


</select>


</label>










{/* 房贷 信用卡 */}



{

(

editing.type==="房贷"

||

editing.type==="信用卡分期"

)

&&


<>


<h3

className="
font-bold
mb-3
"

>

🏠 固定还款贷款

</h3>



<InputBox

title="初始贷款金额"

tip="最开始借的钱，例如3000000"

value={editing.original_amount}

setValue={(v:any)=>

setEditing({

...editing,

original_amount:v

})

}

/>





<InputBox

title="当前剩余本金"

tip="现在还欠多少钱"

value={editing.remaining_amount}

setValue={(v:any)=>

setEditing({

...editing,

remaining_amount:v

})

}

/>





<InputBox

title="年利率 (%)"

tip="例如3.1"

value={editing.interest_rate}

setValue={(v:any)=>

setEditing({

...editing,

interest_rate:v

})

}

/>





<InputBox

title="每月还款"

tip="例如17000"

value={editing.monthly_payment}

setValue={(v:any)=>

setEditing({

...editing,

monthly_payment:v

})

}

/>



</>


}










{/* 保险贷款 */}



{

editing.type==="保险贷款"

&&


<>


<h3

className="
font-bold
mb-3
"

>

🛡️ 保险贷款

</h3>





<InputBox

title="当前贷款余额"

tip="从保单现金价值借出的金额，例如500000"

value={editing.remaining_amount}

setValue={(v:any)=>

setEditing({

...editing,

remaining_amount:v

})

}

/>





<InputBox

title="贷款利率 (%)"

tip="例如5"

value={editing.interest_rate}

setValue={(v:any)=>

setEditing({

...editing,

interest_rate:v

})

}

/>





<InputBox

title="期限(月)"

tip="例如6个月填写6"

value={editing.renew_period_months}

setValue={(v:any)=>

setEditing({

...editing,

renew_period_months:v

})

}

/>





<label

className="
flex
gap-2
items-center
mb-5
"

>


<input

type="checkbox"

checked={editing.renewable}

onChange={e=>

setEditing({

...editing,

renewable:e.target.checked

})

}

/>


到期可以续贷


</label>



</>


}










{/* 银行信用贷 */}



{

editing.type==="银行信用贷"

&&


<>


<h3

className="
font-bold
mb-3
"

>

🏦 银行信用贷

</h3>





<InputBox

title="授信额度"

tip="银行批准最大金额，例如1000000"

value={editing.credit_limit}

setValue={(v:any)=>

setEditing({

...editing,

credit_limit:v

})

}

/>





<InputBox

title="当前使用金额"

tip="已经借出的金额"

value={editing.remaining_amount}

setValue={(v:any)=>

setEditing({

...editing,

remaining_amount:v

})

}

/>





<InputBox

title="年利率 (%)"

tip="例如4.5"

value={editing.interest_rate}

setValue={(v:any)=>

setEditing({

...editing,

interest_rate:v

})

}

/>



</>


}









{/* 日期 */}



<h3

className="
font-bold
mb-3
"

>

📅 时间

</h3>




<input

className="
border
p-3
rounded
w-full
mb-4
"

type="date"

value={editing.start_date||""}

onChange={e=>

setEditing({

...editing,

start_date:e.target.value

})

}

/>




<input

className="
border
p-3
rounded
w-full
mb-5
"

type="date"

value={editing.end_date||""}

onChange={e=>

setEditing({

...editing,

end_date:e.target.value

})

}

/>










{/* Financial Freedom */}



<label

className="
flex
gap-2
items-center
mb-5
"

>


<input

type="checkbox"

checked={editing.include_financial_freedom}

onChange={e=>

setEditing({

...editing,

include_financial_freedom:e.target.checked

})

}

/>


是否计入 Financial Freedom

</label>







<textarea

className="
border
p-3
rounded
w-full
mb-5
"

placeholder="
备注：
例如房贷由公积金覆盖
保险贷款用于资金周转
"

value={editing.note}

onChange={e=>

setEditing({

...editing,

note:e.target.value

})

}

/>









<div

className="
flex
justify-end
gap-4
"

>


<button

className="
px-5
py-2
bg-gray-200
rounded
"

onClick={

()=>setEditing(null)

}

>

取消

</button>





<button

className="
px-5
py-2
bg-blue-600
text-white
rounded
"

onClick={save}

>

保存

</button>



</div>






</div>


</div>


}





</main>


</>

);


}