import {z} from 'zod';

// Zod Schemas based on Config.d.ts, default.json, and validation rules from sea.ts
export const telegramSchema = z.object({
  token: z.string()
    .regex(/^\d{10}:[a-zA-Z0-9_-]{35}$/, 'Invalid token format (should be like: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz08assdfss')
    .describe('🔑 Bot token from @BotFather - required for Telegram bot authentication'),
  chatId: z.number()
    .int()
    .min(10001, 'Invalid Chat format')
    .describe('💬 Your Telegram chat ID - get it from @userinfobot'),
  spamDelay: z.number()
    .nonnegative('Delay must be non-negative')
    .describe('⏱️ Delay between alerts in seconds - short delay will result in many notifications')
    .default(300),
  message: z.string()
    .min(1, 'Message cannot be empty')
    .describe('📨 Alert message text sent when motion is detected')
    .default('Changes detected'),
  initialDelay: z.number()
    .nonnegative('Initial delay must be non-negative')
    .describe('⏰ Initial delay before starting motion detection')
    .default(10),
});

export const cameraSchema = z.object({
  name: z.string()
    .min(1, 'Camera name cannot be empty')
    .describe('📹 Camera name (e.g., "OBS Virtual Camera" or your webcam)')
    .default('OBS Virtual Camera'),
  frameRate: z.number()
    .positive('Frame rate must be positive')
    .describe('🎬 Frame rate in frames per second (recommended: 1-5)')
    .default(1),
});

export const diffSchema = z.object({
  pixels: z.number()
    .positive('Pixel count must be positive')
    .describe('🔍 Minimum changed pixels required to trigger an alert')
    .default(1000),
  threshold: z.number()
    .min(0, 'Threshold must be at least 0.0')
    .max(1, 'Threshold must be at most 1.0')
    .describe('🎯 Change sensitivity level, lower = more aggressive')
    .default(0.1),
});

export const aconfigSchema = z.object({
  telegram: telegramSchema,
  camera: cameraSchema,
  diff: diffSchema,
});

type Config = z.infer<typeof aconfigSchema>
type TelegramConfig = z.infer<typeof telegramSchema>
type CameraConfig = z.infer<typeof cameraSchema>
type DiffConfig = z.infer<typeof diffSchema>

export type {Config, TelegramConfig, CameraConfig, DiffConfig}
