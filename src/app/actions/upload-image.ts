'use server';

import { v2 as cloudinary } from 'cloudinary';

// O Next.js já injeta as variáveis do .env no process.env
// A biblioteca Cloudinary pega essas variáveis automaticamente caso sejam nomeadas corretamente.
// Para garantir, vamos instanciar a configuração:
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) {
      throw new Error('Nenhum arquivo enviado.');
    }

    // Convertendo o arquivo (File) para Buffer, exigido pelo Cloudinary em ambiente Node
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fazendo upload via stream para o Cloudinary
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'atelia', // Organiza as imagens nesta pasta dentro do Cloudinary
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            console.error('Erro no upload para Cloudinary:', error);
            reject({ success: false, error: 'Falha no upload de imagem.' });
          } else {
            resolve({ success: true, secure_url: result?.secure_url });
          }
        }
      );

      // Finaliza o stream passando o buffer
      uploadStream.end(buffer);
    });

  } catch (error: any) {
    console.error('Exceção no uploadImage:', error);
    return { success: false, error: error.message || 'Erro inesperado.' };
  }
}
