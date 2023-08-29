"use strict";
///remplace platoniciens.js
const log=console.log
function getHashInstance(){
	let hash={}
	const changenh=(s,f)=>{
		if(!isNaN(s)){
			s=f(s)
			let z=1n<<BigInt(s)
			hash[z]=s
			return [s,z]
		}
		let rep=new Set()
		let k=0n
		for(let i of s){
			let inu=changenh(i,f)
			rep.add(inu[0])
			k= k | inu[1]
		}
		if(!hash[k]) hash[k]=rep
		return [hash[k],k]
	}
	return [hash, changenh]
}
class RegPoly{
	static hash = {}
	constructor(set,points,calcFaces=true){//set: les faces/aretes... en structure (objets de dim 0: indice entier),, points : liste de <P>
		this.np=points.length
		this.set=set
		this.p=points;
		this.pts=this.p
		this.dim=points[0].n
		this.ajuste();
		this.faces=arr(this.dim,(i=>new Set()))
		if(calcFaces){
			this.faces[this.dim-1]=this.set
			for(let i=this.dim-2;i>=0;i--){
				for(let f of this.faces[i+1]){
					for(let k of f) this.faces[i].add(k)
				}
			}
		}
	}
	ajuste(){//recentre, puis normalise
		P.recentre(this.p)
		let maxdist=0
		for(let i=0;i<this.p.length;i++) maxdist=Math.max(maxdist, this.p[i].norm2())
		const factor=1/Math.sqrt(maxdist)
		for(let i=0;i<this.np;i++) this.p[i]=this.p[i].f(factor);
	}
	static getFromSchlaf(s){
		s=s.split(" ").filter(x=>x.trim()!=="").join(" ")
		
		if(s[0]=="r"){
			let s2=s.substring(1)
			return RegPoly.hash[s]=RegPoly.getFromSchlaf(s2).rectif3D()
		}///ex "r 4 3", "r 5 3"
		if(s=="s1"){///special 1  ("r 4 3".dual() rectifié)
			let inu=RegPoly.getFromSchlaf("r 4 3").dual()
			let num=arr(inu.p.length,i=>0)
			for(let i of inu.faces[1]){
				let [a,b]=[...i]
				num[a]++;num[b]++
			}
			let newp=arr(inu.p.length,i=>(num[i]==3)?inu.p[i]:inu.p[i].f(2/3*Math.sqrt(3)))/////selon wikipedia
			return RegPoly.hash[s]=new RegPoly(inu.set,newp,true)
		}
		if(s=="s2"){///special 2  ("r 5 3".dual() rectifié)
			let inu=RegPoly.getFromSchlaf("r 5 3").dual()
			let num=arr(inu.p.length,i=>0)
			for(let i of inu.faces[1]){
				let [a,b]=[...i]
				num[a]++;num[b]++
			}
			const phi=(1+Math.sqrt(5))/2
			let newp=arr(inu.p.length,i=>(num[i]==5)?inu.p[i].f(Math.sqrt(phi**2+1)):inu.p[i].f(Math.sqrt(3)))/////selon wikipedia
			return RegPoly.hash[s]=new RegPoly(inu.set,newp,true)
		}
		
		let l=s.split(" ")
		let dim=l.length+1
		if(RegPoly.hash[s]) return RegPoly.hash[s]
		if(dim==2){
			let n=l[0]
			let p=arr(n,(k=>new P(new Float32Array([Math.cos(k/n*2*Math.PI),Math.sin(k/n*2*Math.PI)]))))
			let aretes=arr(n,(k=>new Set([k,(k+1)%n])))
			RegPoly.hash[s]=new RegPoly(new Set(aretes), p)
			return RegPoly.hash[s]
		}
		
		//test tetrahedre
		let isTetra=true
		for(let i of l) isTetra&=i=="3";
		if(isTetra)return RegPoly.hash[s]=RegPoly.getTetra(dim)///attribution enn meme temps que return tkt bro
		//test cube
		let isCube=l[0]=="4"
		for(let i=1;i<l.length;i++) isCube&=l[i]=="3"
		if(isCube) return RegPoly.hash[s]=RegPoly.getCube(dim)
		//test octahedre
		let isOcta=l[l.length-1]=="4"
		for(let i=0;i<l.length-1;i++) isOcta&=l[i]=="3"
		if(isOcta) return RegPoly.hash[s]=RegPoly.getCube(dim).dual()
		
		if(s=="3 5") return RegPoly.hash[s]=RegPoly.expand(RegPoly.getFromSchlaf("5"))
		if(s=="5 3") return RegPoly.hash[s]=RegPoly.getFromSchlaf("3 5").dual()///j'avais fait un fonction custom :/ ...
		if(s=="3 3 5") return RegPoly.hash[s]=RegPoly.expand(RegPoly.getFromSchlaf("3 5"))///expand depuis l'isocaedre
		if(s=="5 3 3") return RegPoly.hash[s]=RegPoly.getFromSchlaf("3 3 5").dual()
		if(s=="3 4 3") return RegPoly.hash[s]=RegPoly.get24Cell()
		
		throw "schlafli pas connu "+s		
	}
	dual(){//génère le dual...
		let np=this.set.size // nb de faces 
		let p=[]
		let cur=[]//couples duaux
		for(let face of this.set){
			let c=P.zero(this.dim)
			let f2=flatten(face);
			for(let i of f2) c.inc(this.p[i])
			p.push(c.unit())
			cur.push([face, p.length-1])
		}
		for(let d=this.dim-2;d>=0;d--){
			let cur2=[]
			for(let ar of this.faces[d]){
				let inu=new Set()
				for(let i=0;i<cur.length;i++){
					if(cur[i][0].has(ar)) inu.add(cur[i][1])
				}
				cur2.push([ar,inu])
			}
			cur=cur2
		}
		
		let repset=new Set()
		for(let i=0;i<cur.length;i++) repset.add(cur[i][1])
		return new RegPoly(repset,p)
	}
	static getTetra(dim){/// shlafli 3 3 3 3...
		let s=arr(dim-1,(i=>"3")).join(" ")
		if(RegPoly.hash[s] || dim<3) return RegPoly.getFromSchlaf(s)
		//points
		let p=arr(dim+1,(i=>P.zero()))
		p[0]=P.zero(dim)
		p[1]=P.ui(dim,0);
		for(let d=2;d<=dim;d++){
			P.recentre(p, d)
			let inu=p[0].norm2()
			p[d]=P.ui(dim,d-1).f(Math.sqrt(1-inu))
		}
		///structure (memoisation)
		let hash={}
		const full = s=>{
			let k=toNumber(s);
			if(hash[k]) return hash[k];
			if(s.size<=2){hash[k]=new Set(s); return hash[k]}
			
			let inu=new Set(s);
			let rep=new Set()
			for(let i of s){
				inu.delete(i);
				rep.add(full(inu))
				inu.add(i)
			}
			hash[k]=new Set(rep);
			return rep;
		}////retourne la face fullée, pour l'ensemble s
		
		let set=full(new Set(range(dim+1)));
		return new RegPoly(set, p)
	}
	static getCube(dim){
		const bit= (n,i)=>1*(0!=(n&(1<<i)))
		let p=arr(1<<dim,(k=>P.create(dim,(i=>bit(k,i)))))
		
		const [hash,changenh]=getHashInstance()
		hash[3n]=s(0,1)
		const cube=dim=>{
			if(dim==1) return hash[3n]
			let z=(1n<<BigInt(2*dim+1))-1n///hash actuel
			if(hash[z]) return hash[z]
			let inu=cube(dim-1)
			let rep=new Set()
			let baseSet=new Set(range(1<<(dim-1)))
			for(let i=0;i<dim;i++){
				for(let b=0;b<2;b++){
					//let z2=toNumber(change(baseSet,(n=>insertBit(n,i,b))))
					//if(hash[z2]) rep.add(hash[z2])
					//else{
					let [w,h]=changenh(inu,(n=>insertBit(n,i,b)))
				//	console.log(dim,h.toString(2), h)
					rep.add(w)
					//}
				}
			}
			hash[z]=rep
			return hash[z];
		}
		let rep=cube(dim)
		return new RegPoly(rep,p)
	}
	getCloud(){
		let l=[]//faces
		for(let f of this.faces[2]){
			let inu=[...f]
			let lcorresp=[...flatten(inu)]
			let linv={}
			for(let i=0;i<lcorresp.length;i++) linv[lcorresp[i]]=i
			let inu2=arr(inu.length,i=>{let [a,b]=[...inu[i]]; return [linv[a],linv[b]]})
			let graph=arr(inu.length,i=>[])
			for(let [a,b] of inu2){
				graph[a].push(b);
				graph[b].push(a);
			}
			let rep=[0]
			for(let i=0;i<inu.length-1;i++){
				let cur=rep[rep.length-1]
				let next=graph[cur].pop()
				graph[next]=graph[next].filter(x=>x!=cur)
				rep.push(next)
			}
			l.push(rep.map(x=>lcorresp[x]))
		}
		let l2=[]
		for(let i=0;i<l.length;i++){
			for(let j=1;j<l[i].length-1;j++){
				l2.push(l[i][0])
				l2.push(l[i][j])
				l2.push(l[i][(j+1)%l[i].length])
			}
		}
		const lombres=l2.map(i=>i+this.p.length)
		const decoupe=l.map(i=>i.length-2)
		return new Cloud(this.p,{all:l2.concat(lombres),real:l2, decoupe:decoupe})///real : appartienne vraiment au solide. sinon:ombre. le sol est ajouté dans blend, decoupe : le nombre de triangles par faces réelles (pour ajuster les couleurs)
	}
	static expand(base){//base : un RegPoly. retourne un regpoly de dim +1, construit par "expansion"
		const [hash,changenh]=getHashInstance()

		let dim=base.dim+1///dim finale
		const PV=(dim==3)?(l=>pv(...l)):pv4 /// produit vectorie; à utiliser
		let [a,b]=[...getFirst(base.faces[1])]
		const d=base.p[a].dist2(base.p[b])
		const h=Math.sqrt(d-1)
		const z0=(2-d)/2/h///il faut 1+z²=(h+z)² ==> 1=h²+2hz ==> z=(1-h²)/2h . et h²=d-1
		let pts=arr(base.p.length,(i=>P.create(dim, (k=>(k<dim-1)?base.p[i].l[k]:z0)  )))
		pts.push(P.ui(dim,dim-1).f(h+z0))
		
		//add point au total
		const addpoint=p=>{
			for(let i=0;i<pts.length;i++){
				if(p.dist(pts[i])<d/10){
					return [i,false]
				}
			}
			pts.push(p)
			return [pts.length-1, true]
		}
		
		let tetLayout=RegPoly.getTetra(dim-1).set
		///set du coin de base
		
		let f2=flatten(getFirst(base.set))
		let inutri=[...f2,base.np]///layout du tri de base
		let repset=[inutri]///contient au départ qu'un seul tétraedre
		let facesSeen=new Set()//ensembke des faces déjà vues (en BigInt)
		facesSeen.add(toNumber(inutri))
		
		let toSee=[]
		for(let i of inutri) toSee.push([i,inutri.filter(x=>x!=i)]) //// [vertex spécial, reste]
		while(toSee.length>0){
			let [v,reste]=toSee.shift()
			let u=PV(reste.map(i=>pts[i])).unit()
			let v2=pts[v].plus(u.f(-2*u.scal(pts[v])))
			let [index,isnew]=addpoint(v2)
			let newTet=[...reste,index]
			let newhash=toNumber(newTet)
			if(!facesSeen.has(newhash)){
				facesSeen.add(newhash)
				repset.push(newTet)
				for(let k of reste){
					toSee.push([k, newTet.filter(x=>x!=k)])
				}
			}
		}
		//convertit repset en tetrahedres propres
		let rep=new Set(arr(repset.length,i=>changenh(tetLayout,(j=>repset[i][j]))[0]))
		return new RegPoly(rep, pts)
	}
	static get24Cell(){////ATTENTION SON SET EST INCOMLET MAIS TKT
		let pts=[]
		for(let a=0;a<4;a++){
			for(let b=a+1;b<4;b++){
				for(let inu=0;inu<4;inu++){
					let p=P.zero(4)
					p.l[a]=(inu%2)?1:-1
					p.l[b]=(inu>=2)?1:-1
					pts.push(p)
				}
			}
		}
		let d=10042
		for(let i=1;i<pts.length;i++){
			if(pts[i].dist2(pts[0])<d)d=pts[i].dist2(pts[0])
		}
		let np=pts.length
		let graph=arr(np,i=>new Set())
		let f2=new Set()
		let hashf2={}
		for(let a=0;a<np;a++){
			for(let b=a+1;b<np;b++){
				if(Math.abs(pts[a].dist2(pts[b])- d)<d/100){
					graph[a].add(b)////le node bas connait son cuperieur
					let inu=new Set([a,b])
					f2.add(inu)
					hashf2[toNumber(inu)]=inu
				}
			}
		}
		let tri=new Set()
		for(let i=0;i<np;i++){
			for(let a of graph[i]){
				for(let b of graph[a]){
					if(graph[i].has(b)){
						let inu=[[a,b],[a,i],[i,b]]
						tri.add(new Set(arr(3,(i=>hashf2[toNumber(new Set(inu[i]))]))))
					}
				}
			}
		}
		let rep=new RegPoly(new Set(), pts,false)
		rep.faces[0]=new Set(range(np))
		rep.faces[1]=f2
		rep.faces[2]=tri
		return rep
	}
	rectif3D(puissance=1){///"rectification" uniquemnt pour 3D
		if(puissance>1){
			let that=this.rectif3D()
			for(let i=0;i<puissance-1;i++)that=that.rectif3D()
			return that
		}
		const [hash,changenh]=getHashInstance()

		let flat=[]
		let pts=[]
		for(let i of this.faces[1]){
			let [a,b]=[...i]
			let center=this.p[a].plus(this.p[b]).f(0.5)
			pts.push(center)
			flat.push((a<b)?[a,b]:[b,a])
		}
		let newfaces=arr(this.p.length,i=>{///faces créées par rectification
			let sommets=[]
			for(let j=0;j<flat.length;j++){
				let k=flat[j]
				k=(k[0]==i)?k:[k[1],k[0]]
				if(k[0]==i) sommets.push([j,k[1]])///////////point milieu, autre extrémité
			}
			let aretes=s()
			for(let w of this.faces[2]){
				let inu=flatten(w)
				if(inu.has(i)){
					let [[a,],[b,]]=sommets.filter(q=>inu.has(q[1]))//tkt
					aretes.add(s(a,b))
				}
			}
			return changenh(aretes,i=>i)[0]
		})
		let facesflat=[...this.faces[2]]
		let oldfaces=arr(facesflat.length,i=>{//anciennes faces, tronquées
			let puntos=[...facesflat[i]].map(k=>{
				let [a,b]=[...k]
				if(a>b) [a,b]=[b,a]
				for(let j=0;j<flat.length;j++){
					if(flat[j][0]==a && flat[j][1]==b) return j
				}
			})
			let aretes=s()
			for(let k=0;k<puntos.length;k++){
				for(let j=0;j<k;j++){
					let z=toNumber(s(puntos[k],puntos[j]))
					if(hash[z]) aretes.add(hash[z])
				}
			}
			return changenh(aretes,i=>i)[0];
		})
		return new RegPoly(union(oldfaces, newfaces), pts)
	}
}
/*
let f=[s(0,1),s(2,1),s(2,3),s(3,0),s(0,4),s(1,4),s(2,4),s(3,4)]
const test=new RegPoly(s(s(f[0],f[1],f[2],f[3]),s(f[0],f[4],f[5]),s(f[1],f[6],f[5]),s(f[2],f[6],f[7]),s(f[3],f[4],f[7])),[p(0,0,-1),p(1,0,0),p(0,0,1),p(-1,0,0),p(0,1,0)])
console.log(test, test.getCloud())*/