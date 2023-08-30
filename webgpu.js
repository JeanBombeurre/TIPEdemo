"use strict";
//https://webgpufundamentals.org/webgpu/lessons/webgpu-translation.html
function flattenForShader(mat){///argument : une M. retourne une float32Array de la mat flattended , avec un 0 entre chaque colonne
	let rep=new Float32Array(12)
	for(let y=0;y<3;y++){
		for(let x=0;x<3;x++) rep[4*x+y]=mat.l[y][x]///change éventuellement pour transposed?
	}return rep
}
function createSol(R=60,cote=0.2){///cote:taille du coté des petits triangles, R: nomre de triangles en rayon
	const YSOL=-0.015////y du sol
	
	const h2=Math.sqrt(1-0.5**2)///hauteur géométrique du triangle
	let solp=arr(R+1,x=>p((x-R/2)*cote,YSOL,R*h2*cote))
	let soll0=[]
	let oldW=solp.length
	for(let y=R-1;y>=-R;y--){
		const i=R-y
		const curW=y>0?R+1+i:3*R+1-i
		const newp=arr(curW,x=>p((x-(curW-1)/2)*cote,YSOL,y*h2*cote))
		if(curW>oldW){
			for(let k=0;k<oldW;k++)soll0.push([solp.length-oldW+k,solp.length+k,solp.length+k+1])
			for(let k=1;k<curW-1;k++)soll0.push([solp.length+k,solp.length-oldW+k-1,solp.length-oldW+k])
		}else{
			for(let k=1;k<oldW-1;k++)soll0.push([solp.length-oldW+k,solp.length+k-1,solp.length+k])
			for(let k=0;k<curW;k++)soll0.push([solp.length+k,solp.length-oldW+k,solp.length-oldW+k+1])
		}
		solp=solp.concat(newp)
		oldW=curW
	}
	for(let po of solp){
		let inu=P.randomPointBoule(2)
		po.inc(p(inu.x*cote/2.5,0,inu.y*cote/2.5))
	}
	return {solp,soll0}
}
function blend(points, indices, color, normal){///le blend dans une seule Float32Array. les Colors sont en 0-255 entières. les Indices vont 3 par 3.
/*resultat
(xxxx yyyy zzzz)(rgba)(nx ny nz) ... -> 3 de ces blocs pour une face. dans une face seuls les x y z changent... 
*/
	////sol:
	const {solp,soll0}=createSol()
	const soll=[].concat(...soll0);
	const solcol=[100,100,100,128]///couleur de tout le sol toujours
	const solnormales=arr(solp.length,i=>p(0,1,0).plus(P.randomPointBoule(3).f(0.02)))
	
	const n=indices.length
	const nfaces=normal.length
	let  rep=new Float32Array((n+soll.length)*7)
	const colorData=new Uint8Array(rep.buffer)
	for(let i=0;i<n;i++){/////////vertex ombres+solide
		let iface=i/3|0
		let floatpos=i*7
		let intpos=i*7*4
		rep.set(points[indices[i]].l,floatpos)
		rep.set(normal[iface].l,floatpos+4)
		colorData.set(color[iface],intpos+3*4)
	}
	console.log("soll.length = "+soll.length)
	for(let j=0;j<soll.length;j++){/////////vertex ombres+solide
		let i=j+n
		let floatpos=i*7
		let intpos=i*7*4
		rep.set(solp[soll[j]].l,floatpos)
		rep.set(solnormales[soll[j]].l,floatpos+4)
		colorData.set(solcol,intpos+3*4)
	}
	
	return rep
}
function blendNotChangeColors(points, indices, normal, floatArray){//blend sans changer les couleurs
	const n=indices.length
	const nfaces=normal.length
	for(let i=0;i<n;i++){
		let iface=i/3|0
		let floatpos=i*7
		let intpos=i*7*4
		floatArray.set(points[indices[i]].l,floatpos)
		floatArray.set(normal[iface].l,floatpos+4)
	}
	return floatArray
}
class WebGPURenderer{
	static unis={}//format/size des uniforms
	static uniformBufferSize=0////size du buffer total des uniforms
	static code=`
		struct Uniforms {
			matcam:mat3x3f,
			campos:vec3f,
			dim: vec2f,
			lumAngle:vec3f,///vecteur unitaire d'incidence
			center:vec3f,//centre du cloud
		};
		struct Vertex {
			@location(0) position: vec3f,
			@location(1) color:vec4f,
			@location(2) normale:vec3f,
		};
		struct VSOutput {
			@builtin(position) position: vec4f,
			@location(0) color:vec4f,
			@location(1) pos3d:vec3f,
			@location(2) normale:vec3f,
		};
		@group(0) @binding(0) var<uniform> uni: Uniforms;
		@vertex fn vs(vert: Vertex) -> VSOutput {
			var vsOut: VSOutput;
			let pos3d=uni.matcam*(vert.position-uni.campos);
			vsOut.position=vec4f(uni.dim*pos3d.xy,pos3d.z,pos3d.z+1.0);
			//color
			let k=vert.color.w;
			var normale=normalize(vert.normale);
			if(k==1.0){
				normale=faceForward(normale,-normale,vert.position-uni.center);
			}
			let lum=(1.5+dot(normale,uni.lumAngle))/2.5;//dot(normale,uni.lumAngle)
			vsOut.color=vec4f(vert.color.xyz*lum,vert.color.w);
			vsOut.normale=normale;
			vsOut.pos3d=vert.position;
			return vsOut;
		}
		@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
			let pos=vsOut.pos3d;
			let u=vsOut.normale;////////////ATTENTION POUR LE SOL U PEUT NE PAS ETRE NORMALISé
			let col=vsOut.color.xyz;
			let k=vsOut.color.w;
			let dir=normalize(pos-uni.campos);
			let refl=dir-2.0*u*dot(u,dir);
			var lum:f32;
			let inu=dot(refl,uni.lumAngle);
			if(inu>0.8){lum=smoothstep(0.8,1.0,inu)*0.4+1.0;}else{lum=1.0;}
			if(k>0.4 && k<0.6){ lum=1+(lum-1)/2;}////sol reflète moins que le solide
			if(k==0.0){ return vec4f(0.0,0.0,0.0,0.5);}
			else{return vec4f(lum*col.xyz,1);}
		}
	`
	static async init(unis,canvas){//unis example:["dim:vec2f","zoom:f32","matcam:mat3x3f","campos:vec3f"]
	//ATTENTION LES OFFSETS SONT SUPER COMPLIQUES VOIR https://gpuweb.github.io/gpuweb/wgsl/#alignof et autres
		const adapter = await navigator.gpu?.requestAdapter();
		const device = await adapter?.requestDevice();
		if (!device) {
			alert('need a browser that supports WebGPU');
			return;
		}
		const context = canvas.getContext('webgpu');
		const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
		context.configure({
			device,
			format: presentationFormat,
			alphaMode: 'premultiplied',
		});
		const module=device.createShaderModule({label:"tkt0", code:wu.code})
		const bindGroupLayout = device.createBindGroupLayout({
			entries: [{
				binding: 0,//// group 0 binding 0
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {},
			}]
		});
		const pipelineLayout=device.createPipelineLayout({
			bindGroupLayouts: [
				bindGroupLayout, // @group(0)
			]
		});
		const pipeline = device.createRenderPipeline({
			label: '3d tkt42',
			layout: pipelineLayout,//'auto',
			vertex: {
				module,
				entryPoint: 'vs',
				buffers: [
					{
          			arrayStride: (7) * 4, // (3) floats 4 bytes each + one 4 byte color + 3 floats de normale
						attributes: [
							{shaderLocation: 0, offset: 0, format: 'float32x3'},  // position
           			 	{shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // color
							{shaderLocation: 2, offset: 16, format: 'float32x3'},  // normale
           			 	
						],
					},
				],
			},
			fragment: {
				module,
				entryPoint: 'fs',
				targets: [{ format: presentationFormat }],
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
		});
		wu.unis=[]
		let unisbufsize=0;
		const table={f32:[4,4],vec2f:[8,8],vec3f:[16,12],mat3x3f:[16,48]}///alignement, size depuis cette table : https://gpuweb.github.io/gpuweb/wgsl/#alignof
		let offset=0;
		const roundUp=(a,b)=>(b%a)?b+a-(b%a):b//arrondit b au sup pour etre multpile de a
		let structAlign=0
		for(let i=0;i<unis.length;i++){
			let [name, type]=unis[i].split(':')
			//console.log(i,table)
			let [align, size]=table[type]
			offset=roundUp(align,offset)///offset du membre actuel
			structAlign=Math.max(align, structAlign)
			wu.unis.push({name,offset})
			offset+=size
		}
		wu.uniformBufferSize=roundUp(structAlign,offset)//nombre de bytes total pour tout contenir

		const uniformBuffer = device.createBuffer({
			label: 'uniforms',
			size: wu.uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		const bindGroup = device.createBindGroup({
			label: 'bind group for object tkt',
			layout: bindGroupLayout,//pipeline.getBindGroupLayout(0),///group 0
			entries: [
				{ binding: 0, resource: { buffer: uniformBuffer }},
			],
		});
		const renderPassDescriptor = {
			label: 'our basic canvas renderPass',
			colorAttachments: [
				{
					// view: <- to be filled out when we render
					clearValue:[0.1,0.1,0.2,1],///noir
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
			depthStencilAttachment: {
				// view: <- to be filled out when we render
				depthClearValue: 1.0,
				depthLoadOp: 'clear',
				depthStoreOp: 'store',
			},
		};
		wu.vars={renderPassDescriptor, context, device,pipeline, uniformBuffer,bindGroup}
	}
	static render(unisValues) {//unisValues : {uni1 : Float32Array()...}
		if(!wu.vars) throw "IL faut init avant de render andouille"
		const {renderPassDescriptor, context, device,pipeline, uniformBuffer,bindGroup}=wu.vars
		// Get the current texture from the canvas context and
		// set it as the texture to render to.
		//renderPassDescriptor.colorAttachments[0].view =
		//	context.getCurrentTexture().createView();
		//DEPTH
		const canvasTexture = context.getCurrentTexture();
		renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();
		if (!wu.depthTexture || wu.depthTexture.width !== canvasTexture.width || wu.depthTexture.height !== canvasTexture.height) {
			if (wu.depthTexture) wu.depthTexture.destroy();
			wu.depthTexture = device.createTexture({
				size: [canvasTexture.width, canvasTexture.height],
				format: 'depth24plus',
				usage: GPUTextureUsage.RENDER_ATTACHMENT,
			});
		}
		renderPassDescriptor.depthStencilAttachment.view = wu.depthTexture.createView();

		const encoder = device.createCommandEncoder();
		const pass = encoder.beginRenderPass(renderPassDescriptor);
		pass.setPipeline(pipeline);
		pass.setVertexBuffer(0, wu.vertex);
		//pass.setIndexBuffer(wu.index, 'uint32');
		//set les UNIFORMS
		const unisArray=new Float32Array(wu.uniformBufferSize/4)//nombre de floats
		for(let i=0;i<wu.unis.length;i++){
			unisArray.set(unisValues[wu.unis[i].name], wu.unis[i].offset/4)
		}
		//console.log(unisArray)
		// upload the uniform values to the uniform buffer
		device.queue.writeBuffer(uniformBuffer, 0, unisArray);

		pass.setBindGroup(0, bindGroup);
		//pass.drawIndexed(wu.indexArray.length);
		pass.draw(wu.NUMBER_OF_POINTS)
		pass.end();
		const commandBuffer = encoder.finish();
		device.queue.submit([commandBuffer]);
	}
	static initPoints(points, indices, color, normal){///appeller pour setup les couleurs
		let data=blend(points, indices, color, normal)
		wu.vertex = wu.vars.device.createBuffer({
			label: 'vertex buffer vertices avec colors et normales',
			size: data.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		});
		wu.vars.device.queue.writeBuffer(wu.vertex, 0, data);
		console.log(data)
		wu.vertexData=data;///wu.vertexArray : la float32array (avec length)
		wu.NUMBER_OF_POINTS=data.length/7 /// car 7 floats par vertex
	}
	static setPoints(points, indices, normal){//ne change pas les couleurs
		blendNotChangeColors(points, indices, normal, wu.vertexData)
		wu.vars.device.queue.writeBuffer(wu.vertex, 0, wu.vertexData);
	}
}
const wu = WebGPURenderer
