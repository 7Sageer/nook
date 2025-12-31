import { SaveImage } from "../../wailsjs/go/main/App";

export const useImageUpload = () => {
    const uploadFile = async (file: File): Promise<string> => {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data URL prefix (data:image/png;base64,)
                const base64Data = result.split(",")[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Generate unique filename
        const ext = file.name.split(".").pop() || "png";
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        // Save via Go backend and get file:// URL
        return await SaveImage(base64, filename);
    };

    return { uploadFile };
};
