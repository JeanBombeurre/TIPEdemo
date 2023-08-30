"use strict";
function pv(a,b){// uniquement dim=3
	return new P(new Float32Array([a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x]))
}
class Cloud{//nuage de points
	constructor(p,l){
		this.p=p
		this.l=l
	}
	get dim(){return this.p[0].n}
	get n(){return this.p.length}
	get ln(){return this.l.all.length}
	get nl(){return this.l.all.length}
	mul(m){//multiplie par m
		let p2=new Array(this.n)
		for(let i=0;i<this.n;i++){
			let cur=this.p[i]
			p2[i]=cur.mul(m)
		}
		return new Cloud(p2,this.l)
	}
	translate(v){//translate par v
		let p2=new Array(this.n)
		for(let i=0;i<this.n;i++){
			let cur=this.p[i]
			p2[i]=cur.add(v)
		}
		return new Cloud(p2,this.l)
	}
	project(fov=1, perspective=true){//PROJECTION selon la DERNIERE coordonnée (divise les autres par elle) attention devient foireux quand derrière la cam.  ajuste par le fov
		
		let p2=new Array(this.n)
		for(let i=0;i<this.n;i++){
			let cur=this.p[i]
			let lastcoord=cur.l[cur.n-1]
			let inu=cur.l.slice(0,-1)
			if(perspective)for(let k=0;k<inu.length;k++) inu[k]/=lastcoord
			p2[i]=new P(inu)
		}
		return new Cloud(p2,this.l)
	}
	
	affGPU(cam,center3d,init=false, colorsdiff=false,lumAngle=0.2){////render le cloud courant selon la cam(3D). si la premiere fois quo'on aff un mdele:init=true.
		const lumangle=p(Math.sin(lumAngle),Math.cos(lumAngle),0).unit()///////////////pas dans le bon sens???///

		let ombrespoints=arr(this.p.length,i=>{//calcul de l'ombre
			let p0=this.p[i];
			return p0.plus(lumangle.f(-p0.y/lumangle.y))
		})
		const number_of_real_faces=this.l.real.length/3|0///=nombre de points d'ombre aussi
		const points_a_render=this.p.concat(ombrespoints)
		
		let normales=arr(number_of_real_faces,i=>{
			let inu=this.p[this.l.real[i*3+2]];
			return pv(this.p[this.l.real[i*3]].moins(inu),this.p[this.l.real[i*3+1]].moins(inu))
		}).concat(new Array(number_of_real_faces).fill(p(0,1,0)))
		let iface=0;
		let jface=0;
		let curcol=[]
		if (init){
			let cols=colorsdiff?arr(2*number_of_real_faces,i=>{
				if(i<number_of_real_faces){
					if(jface==0){
					let x=Math.random()
						curcol=[x*255|0,(1-x)*255|0,Math.random()*255|0,255]
						//[255,120,100,255]///couleur du solide. alpha=255 : solide
					}
					jface++;if(jface>=this.l.decoupe[iface]){jface=0;iface++}
					return curcol
				}else{
					return [10,10,10,0]//// couleur de l'ombre. alpha=0, ombre.
				}///sol ajouté dans "blend"
			}):arr(2*number_of_real_faces,i=>{
				if(i<number_of_real_faces) return [255,120,100,255]///couleur du solide. alpha=255 : solide
				else return [10,10,10,0]//// couleur de l'ombre. alpha=0, ombre.
			})///sol ajouté dans "blend"
			WebGPURenderer.initPoints(points_a_render,this.l.all,cols,normales)
		}else{
			WebGPURenderer.setPoints(points_a_render,this.l.all,normales)
		}
		//setup uniforms et render
		const W=canvas.width
		const H=canvas.height
		const dim=(W<H)?[H/W,1]:[1,W/H] 
		const caminv=cam.minv	

		WebGPURenderer.render({
			dim,
			matcam:flattenForShader(caminv),
			campos:cam.pos.l,
			lumAngle:lumangle.l,//.mul(caminv), 
			center:center3d.l//.mul(caminv).l////centre dans le bon referentiel du shader
		})
	}
}

class Solide{
	constructor(cloud,pos=undefined,m=undefined){
		this.cloud=cloud
		this.n=cloud.p[0].n//dimension
		this.dim=this.n
		this.m=m || M.id(this.n)
		let n=this.n
		this.v=P.zero(n)
		this.acc=M.empty(n,n)//P.zero(n)
		this.pos=pos || P.zero(n)
		this.rot=M.empty(n,n)
		this.np=cloud.p.length;
		
		this.MASSREPARTITION = 0.2 //20% de la masse au centre, 80% repartis sur les points	
		this.pm=(1-this.MASSREPARTITION)/this.np // masse d'un point à l'ext
		
		//costruction de curcloud (le cloud à un instant t) : cloud de base rotationné, pas translaté
		//let inu=arr(this.np)
		//for(let i=0;i<inu.length;i++) inu[i]=this.cloud.p[i].copy()
		//this.curcloud=new Cloud(inu,this.cloud.l)
		this.calcCurCloud()
	}
	/*proj(cam){//returns le cloud projeté par cam
		let cloud=this.curcloud.translate(this.pos)
		let c2=cam.apply(cloud)
		return c2
	}*/
	getCloud(){///returns le cloud affichable
		return this.curcloud.translate(this.pos)
	}
	calcCurCloud(){
		this.curcloud=this.cloud.mul(this.m)
	}
	collisions(){
		if(this.pos.l[1]>1.01) return//////au-dessus du sol
		let min=0
		let imin=0;
		for(let i=0;i<this.np;i++){
			if(this.curcloud.p[i].l[1]+this.pos.l[1]<min){
				min=this.curcloud.p[i].l[1]+this.pos.l[1]
				imin=i;
			}
		}
		if(min<0){
			this.pos.l[1]-=min
			this.calcCurCloud()
			
			let application=this.curcloud.p[imin]
			let vapp=application.mul(this.rot).plus(this.v)
			
			this.pingP(application,vapp.opp())///no friction
		}
	}
	
	actu(grav,dt=1){//grav  : un réel décrivant la gravité SELON LA 2E COORDONNEE (Y)
		this.v.inc(P.ui(this.n,1).f(-grav*dt))//gravité selon -y
		this.acc=this.rot.mul(this.rot)
		this.pos.inc(this.v.f(dt))
		//this.effetBizarreCouple(dt)
		this.m=this.m.mul(this.rot.exp(dt))
		this.calcCurCloud()
		
		this.collisions()
		
		this.m.ortho()///reorthogonalise
		
	}
	pingP(p,v){////assure la bonne vitesse dans la direction v (mais peut être décalée)
		let vortho=v.proj(p);
		let vdroit=v.sub(vortho);
		this.v.inc(vdroit);
		//plus que la composante ortho à faire. Coefficient au pif, devrait etre trouvé par analyse linéaire
		//faux
		const d=p.norm()////est SOUVENT 1... sauf pour quelques uns
		const pu=p.f(1/d)///=p.unit()
		this.rot.inc(M.getCouple(p,vortho.f(1/d)).f(0.6));
		this.v.inc(vortho.f(0.4))
		//this.applyCouple(M.getCouple(p,v))
	}
}
