import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

export interface GenerateStudyImageOptions {
  topic?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16';
  apiKey?: string;
  geminiApiKey?: string;
}

export interface GeneratedImageResult {
  localPath: string;
  fileName: string;
  promptUsed: string;
  provider: 'google-imagen3' | 'openai-dalle3' | 'pollinations-free';
}

const CURATED_STUDY_PROMPTS = [
  // 1. Desk Flat-lay (Passport, Visa, Globe, Graduation cap)
  'Aesthetic high-angle flat-lay photograph on a warm polished walnut study desk. Features an international student passport with an official gold visa stamp, a boarding pass to the UK, an elegant graduation cap with a golden tassel, a rolled diploma with ribbon, an antique brass globe, a brass navigational compass, a fountain pen, an open leather journal, and a cup of warm coffee. Soft morning window sunlight, cozy academic atmosphere, clean commercial advertising composition with open negative space for text overlay. Completely empty scene, absolutely no humans, no people, no hands, no faces, no human silhouettes, no animals. 8k resolution, photorealistic.',

  // 2. Majestic University Campus Architecture
  'Breathtaking architectural commercial photography of an iconic, grand collegiate Gothic university library and clock tower. Morning golden sunlight casting warm beams across lush green manicured campus lawns and ornate stone archways. A pristine stone walkway leads towards grand oak entrance doors. Clear blue morning sky, majestic historic academic grandeur. Clean composition with ample negative space in the sky and lawn for text/logo placement. Completely empty campus, absolutely no humans, no people, no crowds, no animals. 8k resolution, cinematic commercial quality.',

  // 3. Cozy Library Study Desk with Acceptance Letter
  "Cozy and inspiring study sanctuary still life. A polished mahogany library study desk bathed in the warm amber glow of a classic brass banker's lamp. On the desk: an open hardcover textbook with highlighted study notes, a fountain pen, a sleek laptop displaying an official university acceptance letter with 'Congratulations' headline, a cup of steaming tea on a saucer, and a passport beside sticky notes. Floor-to-ceiling wooden bookshelves filled with books softly blurred into bokeh in the background. Tranquil, intellectual, motivating atmosphere. Ample negative space for typography. Absolutely no humans, no people, no hands, no animals, purely inanimate objects. 8k resolution.",

  // 4. Modern Study Abroad Travel Essentials
  'Clean minimal flat-lay for higher education study abroad campaign. A modern backpack resting beside a leather passport holder, international flight ticket to Canada, university course catalog brochure, sleek tablet, fountain pen, and a cup of cappuccino on a bright Nordic wooden desk. Inspiring, bright natural daylight. Ample negative space for headline text and brand logo. Absolutely no humans, no people, no animals. Commercial studio still life photography, 8k resolution.',

  // 5. Historic Grand University Lecture Hall (Empty)
  'Majestic historic university lecture hall with rows of polished wooden tiered desks and vintage reading lamps leading down to a grand chalkboard with mathematics and academic notes. Sunbeams streaming through towering stained glass windows. Completely quiet, empty, and awe-inspiring academic sanctuary. Absolutely no humans, no people, no animals. Crisp architectural photography, 8k resolution.',

  // 6. University Acceptance & Scholarship Celebration Desk
  'Still life composition of an official university admission offer letter and scholarship certificate resting on a luxurious walnut desk beside a world globe, vintage fountain pen, and stacked hardcover books. Soft warm bokeh background of an academic hall. Elegant and inspiring higher education aesthetics. Negative space for social media ad layout. Absolutely no humans, no people, no animals. High-end commercial advertisement quality.'
];

export function buildStudyPrompt(topic?: string): string {
  if (!topic || topic.trim() === '' || topic.toLowerCase() === 'random') {
    const randomIndex = Math.floor(Math.random() * CURATED_STUDY_PROMPTS.length);
    return CURATED_STUDY_PROMPTS[randomIndex];
  }

  return `Commercial advertising photography for higher education and study abroad visa: ${topic.trim()}. Inanimate still-life composition only, featuring elements such as study desk, textbooks, passport with visa stamp, graduation cap, acceptance letter, world globe, or prestigious empty university campus architecture. Clean, balanced composition with generous open negative space for social media ad headlines and logo placement. Absolutely no humans, no people, no faces, no hands, no silhouettes, no animals. Completely inanimate and empty. Crisp lighting, photorealistic 8k resolution, premium corporate branding look.`;
}

export async function generateStudyImage(
  options: GenerateStudyImageOptions = {}
): Promise<GeneratedImageResult> {
  const { topic, aspectRatio = '1:1', apiKey, geminiApiKey } = options;
  const prompt = buildStudyPrompt(topic);

  const effectiveGeminiKey = geminiApiKey || config.imageGen.geminiApiKey || (apiKey?.startsWith('AIza') ? apiKey : undefined);
  const effectiveOpenAIKey = config.imageGen.openaiApiKey || (apiKey?.startsWith('sk-') ? apiKey : apiKey);

  const outputDir = path.resolve(process.cwd(), 'generated_images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `study_${timestamp}.jpg`;
  const localPath = path.join(outputDir, fileName);

  // 1. Google Gemini / Imagen 3 (Nano Banana Architecture)
  if (effectiveGeminiKey) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${effectiveGeminiKey}`,
        {
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            personGeneration: 'DONT_ALLOW',
            outputOptions: { mimeType: 'image/jpeg' },
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );

      const b64 = response.data?.predictions?.[0]?.bytesBase64Encoded;
      if (b64) {
        fs.writeFileSync(localPath, Buffer.from(b64, 'base64'));
        return {
          localPath,
          fileName,
          promptUsed: prompt,
          provider: 'google-imagen3',
        };
      }
    } catch (err: any) {
      console.warn(
        `[ImageGen] Google Imagen 3 (Nano Banana) failed (${err?.response?.data?.error?.message || err?.message || err}). Trying OpenAI fallback...`
      );
    }
  }

  // 2. OpenAI DALL-E 3
  if (effectiveOpenAIKey) {
    try {
      const sizeMap: Record<string, '1024x1024' | '1792x1024' | '1024x1792'> = {
        '1:1': '1024x1024',
        '16:9': '1792x1024',
        '9:16': '1024x1792',
      };
      const size = sizeMap[aspectRatio] || '1024x1024';

      const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: 'dall-e-3',
          prompt,
          n: 1,
          size,
          quality: 'standard',
          response_format: 'b64_json',
        },
        {
          headers: {
            Authorization: `Bearer ${effectiveOpenAIKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const b64 = response.data?.data?.[0]?.b64_json;
      if (b64) {
        fs.writeFileSync(localPath, Buffer.from(b64, 'base64'));
        return {
          localPath,
          fileName,
          promptUsed: prompt,
          provider: 'openai-dalle3',
        };
      }
    } catch (err: any) {
      console.warn(
        `[ImageGen] OpenAI DALL-E 3 failed (${err?.message || err}). Falling back to free AI generator...`
      );
    }
  }

  // 3. Free Fallback: High Quality Generator (Pollinations / Flux)
  const dimMap: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
  };
  const { width, height } = dimMap[aspectRatio] || dimMap['1:1'];
  const seed = Math.floor(Math.random() * 1000000);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  try {
    const imgResponse = await axios.get(pollinationsUrl, {
      responseType: 'arraybuffer',
      timeout: 45000,
    });

    fs.writeFileSync(localPath, Buffer.from(imgResponse.data));

    return {
      localPath,
      fileName,
      promptUsed: prompt,
      provider: 'pollinations-free',
    };
  } catch (freeErr: any) {
    const errorDetail = freeErr?.response?.data
      ? Buffer.from(freeErr.response.data).toString('utf-8')
      : freeErr.message;
    throw new Error(
      `Image generation failed (${errorDetail}). TIP: Please add GEMINI_API_KEY or OPENAI_API_KEY to .env for high-res instant AI generation.`
    );
  }
}
