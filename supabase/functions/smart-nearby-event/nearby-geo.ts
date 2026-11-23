export function distanceMeters(lat1:number,lon1:number,lat2:number,lon2:number):number {
 const R=6371000,rad=(v:number)=>v*Math.PI/180;
 const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
 const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
 return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export function validCoordinate(lat:number,lng:number):boolean {
 return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
}

export function normalizeRadius(value:unknown):number { const n=Number(value); return Number.isFinite(n)?Math.min(2000,Math.max(50,n)):250; }
