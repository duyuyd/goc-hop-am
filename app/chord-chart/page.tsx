import SongChordChart from "@/components/SongChordChart";
export const metadata={title:"Biểu đồ hợp âm | Góc Hợp Âm"};
export default async function Page({searchParams}:{searchParams:Promise<{url?:string;id?:string}>}){
 const query=await searchParams;
 return <SongChordChart url={query.url} id={query.id}/>;
}
