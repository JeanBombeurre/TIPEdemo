"use strict";
class Cam{//caméra en n dimensions
	constructor(pos){//en 3D pour l'instant, A changer
		this.pos=pos
		this.dim=pos.dim
		
		this.fov=1
		this.m=M.id(this.dim)
	}
	get minv(){return this.m.transpose()}//car orthogonale
	apply(cloud, infos){//projette le Cloud en dim n-1 selon la Cam, retourne un Cloud de dim n-1
		let c1=cloud.translate(this.pos.opp()).mul(this.minv)
		let c2=c1.project(this.fov, infos.perspective)
		return c2
	}
}
function actucam(displayCouple){
	const v=0.1
	const va=0.03
	let cam=cs.l[3]
	let dv={z:[0,0,1],s:[0,0,-1],d:[1,0,0],q:[-1,0,0],a:[0,1,0],e:[0,-1,0]}
	let da={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]}
	for(let i in dv){
		if(kp[i]) {
			if(!dv[i][1])cam.pos.inc(p(...dv[i]).mul(cam.m).proj(p(0,1,0)).unit().f(v))//marrant
			else
				cam.pos.inc(p(...dv[i]).f(v))
		}
	}
	let dz=[0,0]
	for(let i in da){
		if(kp[i]) dz=[dz[0]+da[i][0],dz[1]+da[i][1]]
	}
	let inu=M.getCouple(cam.m.getCol(2),p(0,dz[1],0).mul(cam.m)).exp(va)
	cam.m=cam.m.mul(inu)
	cam.m=cam.m.mul(M.getCouple(p(0,0,1),p(dz[0],0,0)).exp(va))
	const couple=0.05
	let RESULTANTE=M.empty(S.dim,S.dim)
	let x=0,y=1//////on parcourt l'espace des couples en escaliers...
	for(let i=0;i<keysCouples.length;i++){
		if(kp[keysCouples[i][0]]) RESULTANTE.inc(M.getCouple(P.ui(S.dim,x),P.ui(S.dim,y)))
		if(kp[keysCouples[i][1]]) RESULTANTE.inc(M.getCouple(P.ui(S.dim,x),P.ui(S.dim,y).f(-1)))
		x++
		if(x>=y) {y++;x=0}
		if(y>=S.dim) break
	}
	S.rot.inc(RESULTANTE.f(couple))
	if(displayCouple)actuCanCouple(RESULTANTE)
	if(cam.pos.y<0.02)cam.pos.l[1]=0.02
}
class CamChain{
	constructor(dim){
		this.dim=dim
		this.zoomSuccessifs=3//zoome un peu entre chaque dimension
		this.l=[-1,-1,-1]
		for(let i=3;i<=dim;i++){
			let pos=P.ui(i,i-1).f(-3)
			this.l.push(new Cam(pos))
		}
	}
	apply(cloud,infos={perspective: true, initPoints:true, colorsdiff:false}){///cloud est possiblement le simplex en question, initPoints=true ssi on redner un modèle pour la 1e fois
		let rep=cloud
		if(infos.perspective) {
			for(let i=this.dim;i>=4;i--)cloud=this.l[i].apply(cloud,infos).mul(M.id(i-1).mulr(this.zoomSuccessifs))
		}else{
			for(let i=this.dim;i>=4;i--)cloud=this.l[i].apply(cloud, infos)
		}
		//affiche avec webgpu
		const center3d=P.zero(3);
		for(let i=0;i<cloud.p.length;i++)center3d.inc(cloud.p[i].f(1/cloud.p.length))
		cloud.affGPU(this.l[3],center3d,infos.initPoints,infos.colorsDiff)
	}
}