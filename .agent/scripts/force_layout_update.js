import { db } from './src/firebase';
import { doc, getDoc, setDoc } from "firebase/firestore";

const updateLayout = async () => {
    const docRef = doc(db, "storeSettings", "homepage_layout");
    const newLayout = [
        { type: "category_bubbles" },
        { type: "product_shelf", title: "Desejos da Semana", subtitle: "Season Highlights", filter: "all", id: "mod_promo_1" },
        { type: "video_stories", title: "Instantes Ale", subtitle: "Moments to Inspire", videos: [
            { src: 'https://v1.pexels.com/video-files/3958156/3958156-uhd_1440_2160_25fps.mp4', label: 'Brisa de Búzios' },
            { src: 'https://v1.pexels.com/video-files/3959522/3959522-uhd_1440_2160_25fps.mp4', label: 'Vibração Solar' },
            { src: 'https://v1.pexels.com/video-files/2795395/2795395-uhd_1440_2160_25fps.mp4', label: 'Editorial Resort' },
            { src: 'https://v1.pexels.com/video-files/4038482/4038482-uhd_1440_2160_25fps.mp4', label: 'Coleção Elite' }
        ], id: "mod_vid_1" },
        { type: "lifestyle_banner", image: "https://res.cloudinary.com/dl57uueqp/image/upload/f_auto,q_auto,w_1200/v1775996182/xl6j0v77rwks6bpocry0.jpg", title: "Coleção Ferradura", subtitle: "Estilo de Vida", linkCat: "Bikinis", id: "mod_ban_1" },
        { type: "product_shelf", title: "Universo Bikini", subtitle: "The Collection", filter: "Bikinis", id: "mod_prod_1" },
        { type: "promo_grid", id: "mod_pgrid_1" },
        { type: "product_shelf", title: "Saídas & Acessórios", subtitle: "Finishing Touches", filter: "Saídas de Praia", id: "mod_prod_2" },
        { type: "trust_bar" }
    ];
    
    try {
        await setDoc(docRef, { layout: newLayout });
        console.log("✅ Homepage Layout atualizado com sucesso no Firebase!");
        process.exit(0);
    } catch(e) {
        console.error("❌ Erro ao atualizar:", e);
        process.exit(1);
    }
};

updateLayout();
