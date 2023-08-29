"use strict";
//A FAIE : réécris tout pour une seuls float32array
function gaussian(){
	//retourne un réel random avec une distribution normale de moyenne 0 et d'écart-type 1
	//Box-Muller transformation
    return Math.sqrt(-2.0*Math.log(1-Math.random()))*Math.cos(2.0*Math.PI*Math.random());
}
function arr(n,f=false){
	let rep=[]
	rep.length=n
	if(!f) return rep
	for(let i=0;i<n;i++) rep[i]=f(i);
	return rep;
}
class M{
	constructor(l){
		this.l=l
		this.w=l[0].length
		this.h=l.length
	}
	static empty(w,h){return new M(arr(h,(i=>new Float64Array(w))))}
	static create(w,h,f){return M.empty(w,h).fill(f)}
	
	fill(f){
		for(let y=0;y<this.h;y++){
			for(let x=0;x<this.w;x++) this.l[y][x]=f(x,y)
		}
		return this
	}
	iter(f){
		for(let y=0;y<this.h;y++){
			for(let x=0;x<this.w;x++) f(x,y,this.l[y][x])
		}
	}
	copy(){
		//retourne une deepcopy de this (marche que avec les TypedArray)
		let rep=M.empty(this.w,this.h)
		for(let i=0;i<rep.h;i++) rep.l[i].set(this.l[i])
		return rep;
	}
	mul(a){
		///resultat : a*this
		let w=this.w
		let rep=M.empty(this.w,a.h)
		for(let y=0;y<a.h;y++){
			for(let x=0;x<w;x++){
				let s=0
				for(let i=0;i<a.w;i++) s+=a.l[y][i]*this.l[i][x]
				rep.l[y][x]=s;
			}
		}
		return rep
	}
	flatten(){
		return arr(this.w*this.h,(i=>this.l[i/this.w|0][i%this.w]))
	}
	mulr(r){
		//multiplie par un réel et retourne la NOUVELLE matrice
		return M.create(this.w,this.h,((x,y)=>this.l[y][x]*r))
	}
	add(b){
		//retourne une NOUVELLE Matrix
		return M.create(this.w,this.h,((x,y)=>b.l[y][x]+this.l[y][x]))
	}
	sub(b){//NOUVELLE Matrix
		return M.create(this.w,this.h,((x,y)=>-b.l[y][x]+this.l[y][x]))
	}
	inc(b){
		//REMPLACE this par la somme
		this.fill((x,y)=>b.l[y][x]+this.l[y][x])
		return this
	}
	dec(b){///remplace par la différnce
		this.fill((x,y)=>-b.l[y][x]+this.l[y][x])
		return this
	}
	addDiag(b){
		//NOUVELLE Matrix
		let rep=this.copy()
		let m=Math.min(this.w,this.h)
		for(let i=0;i<m;i++) this.l[i][i]+=b
		return rep;
	}
	incDiag(b){
		//s'incrémente sa propre diag
		let m=Math.min(this.w,this.h)
		for(let i=0;i<m;i++) this.l[i][i]+=b
		return this
	}
	pow(n){
		if(n==0) return M.empty(this.h,this.w).incDiag(1)
		if(n==1) return this.copy()
		if(n%2) return this.mul(this).pow(Math.round(n/2))
		return this.mul(this).pow(Math.floor(n/2)).mul(this)
	}
	poly(lcoeffs){
		//retourne le polynôme correspondant
		if(lcoeffs.length==0) return M.empty(this.w,this.h)
		if(lcoeffs.length==1) return M.empty(this.w,this.h).addDiag(lcoeffs[0])
		let rep=this.mulr(lcoeffs[lcoeffs.length-1]).incDiag(lcoeffs[lcoeffs.length-2])
		for(let i=lcoeffs.length-3;i>=0;i--){
			rep=rep.mul(this).incDiag(lcoeffs[i])
		}
		return rep;
	}
	norm2(){//somme des carrés des coeffs de la matrice
		let rep=0
		this.iter((x,y,v)=>rep+=v*v)
		return rep
	}
	exp(x){//return exp(xM), par DL d'ordre k. ordre du dl acceptable mesuré expérimentalement (à remesurer?)
	///à appeller UNIQUEMENT pour matrices skew-symmetric
	//est reorthogonalisé derrière
		const k=Math.max(12,this.h*2)
		let l=new Array(k)
		let inu=1
		for(let i=0;i<k;i++){
			l[i]=inu
			inu*=x/(i+1)
		}
		return this.poly(l).ortho()////orthogonalis à la fin quand même
	}
	static randomSkew(n){///génère une matric skew-symmetrix random (avec isotropie) de norme 1
		let inu=P.randomPointSphere((n*(n-1)/2)|0)
		let rep=M.empty(n,n)
		let x=0
		let y=1
		for(let i=0;i<inu.n;i++){
			rep.l[y][x]=inu.l[i]
			rep.l[x][y]=-inu.l[i]
			x++
			if(x>=y) {x=0;y++}
		}
		return rep
	}
	static getCouple(p,v){// v la force du point en nD, retourne la Rot correspondante
		///assomption qu'un peu tout est linéaire
		/// et que ||p||=1
		let n=p.n
		let rep=M.empty(n,n)
		for(let x=0;x<n;x++){
			let a=p.l[x]
			for(let y=0;y<n;y++){
				let k=a*v.l[y]
				rep.l[y][x]+=k
				rep.l[x][y]-=k
			}
		}
		return rep;
	}
	f(b){return this.mulr(b)}
	static id(n){return M.empty(n,n).incDiag(1)}
	ortho(){//////orthogonalise EN PLACE ordre des dim non random (à changer?)
		let cols=arr(this.w,i=>this.getCol(i))
		
		for(let i=0;i<this.w;i++){
			let cur=cols[i]
			for(let j=0;j<i;j++){
				cur.proj(cols[j])///pas besoin de renormalize à chaque fois (?) pas trop de risque normalement
			}
			cols[i]=cur.unit()
		}
		this.fill((x,y)=>cols[x].l[y])
		return this
	}
	getCol(x){///retourne la x-ieme colonne sous forme d'un Point
		let rep=new Float64Array(this.h)
		for(let i=0;i<this.h;i++) rep[i]=this.l[i][x]
		return new P(rep)
	}
	static fromPoints(lp){//construit la mat avec les lp en colonnes
		let h=lp[0].n
		let w=lp.length
		let rep=M.create(w,h,(x,y)=>lp[x].l[y])
		return rep;
	}
	transpose(){
		return M.create(this.h,this.w,(x,y)=>this.l[x][y])
	}
	rotateCouple(mat){//mat orthogonale, retourne le couple rotaté
		return mat.transpose().mul(this).mul(mat);
	}
	det(){///Sarrus, uniquement n=3
		let rep=0;
		if(this.w!=3 || this.h!=3 ) throw "mauvaises dimensions pour det"
		for(let y=0;y<3;y++){
			let inu=1
			for(let j=0;j<3;j++)  inu*=this.l[(y+j)%3][j]
			rep+=inu
		}
		for(let y=0;y<3;y++){
			let inu=1
			for(let j=0;j<3;j++)  inu*=this.l[(y-j+3)%3][j]
			rep-=inu
		}
		return rep
	}
	static randomMatrix(w,h){//retourne une matrice random de vecteurs de longueur tous 1, non orthonormale
		return M.fromPoints(arr(w,i=>P.randomPointSphere(h)))
	}
}
const Matrix=M
class P{
	//représente un point/vecteur n-dimensionnel
	constructor(l){//l:TypedArray ou <list>
		this.l=l
		this.n=l.length
	}
	static create(n,f){
		let p=new P(new Float32Array(n))
		for(let i=0;i<n;i++) p.l[i]=f(i);
		return p
	}
	scal(b){//produit scalaire avec b
		let rep=0;
		for(let i=0;i<this.n;i++) rep+=this.l[i]*b.l[i]
		return rep
	}
	copy(){//copie lol
		let rep=new Float64Array(this.n)
		rep.set(this.l)
		return new P(rep);
	}
	//A FAIRE : n-produit vectoriel
	mul(m){//multiplie à gauche par matrice m (retourne m * this)
		let rep=new Float64Array(m.h)
		for(let y=0;y<m.h;y++){
			let s=0;
			for(let i=0;i<this.n;i++) s+=this.l[i]*m.l[y][i]
			rep[y]=s
		}
		return new P(rep)
	}
	f(r){//multiplication par scalaire, retourne un nouveau vecteur
		let rep=this.copy()
		for(let i=0;i<rep.n;i++) rep.l[i]*=r
		return rep;
	}
	add(b){//retourne un nouveau vecteur
		let rep=this.copy()
		for(let i=0;i<this.n;i++) rep.l[i]+=b.l[i]
		return rep;
	}
	plus(b){return this.add(b)}
	inc(b){//en place
		for(let i=0;i<this.n;i++) this.l[i]+=b.l[i]
	}
	sub(b){//soustraction
		let rep=this.copy()
		for(let i=0;i<this.n;i++) rep.l[i]-=b.l[i]
		return rep;
	}
	dist2(b){//retourne la distance euclidienne carrée (en n dimensions) entre this et b (cad : somme des (Ai-Bi)²)
		let rep=0
		for(let i=0;i<this.n;i++) rep+=(this.l[i]-b.l[i])**2
		return rep;
	}
	dist(b){//distance euclidienne avec b
		return Math.sqrt(this.dist2(b))
	}
	norm2(){//retourne la norme carrée (j'utilise pas dist(0) pour plus d'efficacité)
		let rep=0
		for(let i=0;i<this.n;i++) rep+=this.l[i]**2
		return rep
	}
	norm(){return Math.sqrt(this.norm2())}
	unit(){return this.f(1/this.norm())}//normalise le vecteur
	static ui(n,i){///i-ème vecteur de la base en n dimensions
		let rep=new Float64Array(n)
		rep[i]=1
		return new P(rep)
	}
	static randomPointSphere(n){
		///retourne un point de dim n SUR LA SPHERE de rayon 1 centrée à l'origine, proba uniforme
		let l=new Float64Array(n)
		let d2=0
		for(let i=0;i<n;i++) d2+=(l[i]=gaussian())**2
		return new P(l).f(1/Math.sqrt(d2))
	}
	static randomPointBoule(n){
		///retourne un point de dim n DANS LA BOULE de rayon 1 centrée à l'origine, proba uniforme
		let p=P.randomPointSphere(n)
		let r=Math.random()**(1/n)
		return p.f(r)
	}
	proj(p){///projette this sur le plan normal à p
		let sc=this.scal(p)
		return this.sub(p.f(sc/p.norm2()))
	}
	projD(p){///projette this sur la droite dirigée par p
		let sc=this.scal(p)
		return p.f(sc/p.norm2())
	}
	
	static zero(n){return new P(new Float64Array(n))}
	opp(){//donne l'opposé (NOUVEAU POINT)
		let rep=P.zero(this.n)
		for(let i=0;i<this.n;i++)rep.l[i]=-this.l[i]
		return rep
	}
	moins(b){return this.sub(b)}
	get x(){return this.l[0]}
	get y(){return this.l[1]}
	get z(){return this.l[2]}
	get dim(){return this.n}
	static recentre(l, imax=-1){///recentre la liste des points, en considérant la liste jusquà imax exclus
		if(imax==-1) imax=l.length
		let n=l[0].n
		let c=P.zero(n)
		for(let i=0;i<imax;i++) c.inc(l[i])
		c=c.f(-1/imax)
		for(let i=0;i<imax;i++) l[i].inc(c)
	}
}
function range(a,b="no",s="no"){
	if(b=="no"){b=a;a=0;s=1}
	if(s=="no"){s=1}
	
	let rep=[]
	for(let i=a;i<b;i+=s) rep.push(i)
	return rep
}
const p=(...l)=>new P(new Float32Array(l))
const s=(...l)=>new Set(l)
function pv4(l){//priduit vectoriel dim 4. il faut len(l)=3
	let rep=P.create(4,i=>{
		let m=M.create(3,3,(x,y)=>l[x].l[/*(y+i+1)%4*/(y<i)?y:y+1])//
		//console.log(m,m.det())
		return m.det()*((i%2)?1:-1);/////////////j'ai vérifié empiriquement.......tkt?
	})
	return rep;
}
/*for(let i=0;i<100;i++){
	const r=()=>new P(new Float32Array([Math.random(),Math.random(),Math.random(),Math.random()]))
	let l=[r(),r(),r()]
	let k=pv4(l)
	console.log(k.norm2())
}*/