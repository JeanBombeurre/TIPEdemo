"use strict";
//focntion de manips de Sets
function flatten(s){//aplatit un Set nested
	if(typeof(s)=="object"){
		let rep=new Set()
		for(let i of s){
			let inu=flatten(i)
			if(typeof(inu)=="object"){
				for(let k of inu) rep.add(k)
			}else{rep.add(inu)}
		}
		return rep;
	}else return s
}
function union(setA, setB) {
	if(setB.size>setA.size) return union(setB,setA)
  let _union = new Set(setA);
  for (let elem of setB) _union.add(elem);
  return _union;
}
function intersection(set1, set2){return new Set([...set1].filter((x) => set2.has(x)))}
function prive(set1, b){return new Set([...set1].filter(x => x!=b))}///b un element à enlever
function getFirst(s){//retourne le premier élement
	for(let i of s) return i
}
function change(s, f){//change les valeurs au niveau 0 par f, retourne le nouveau set
	if(typeof(s)=="object"){
		let rep=new Set()
		for(let i of s) rep.add(change(i,f))
		return rep;
	}else 
		return f(s)
}
////marchent uniquement avec des bigInt
const toNumber=s=>{let rep=0n;for(let i of s) rep+=1n<<BigInt(i); return rep}
const toSet=n=>{let rep=new Set();for(let i=0;n>0n;i++){if(n%2n) rep.add(i);n=n/2n}return rep}
const insertBit=(n,i,b)=>{
	return (n>>i)<<(i+1) ^ b*(1<<i) ^ n%(1<<i)
}