/**
 * X/Twitter Daily Posting Service
 * Creates daily posts for top and least performing bots
 * - Generates images using Google Gemini 2.5 Flash Image via OpenRouter
 * - Generates tweet text using AI
 * - Posts to X/Twitter API
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { GoogleGenAI } from '@google/genai';
import type { DbClient } from '../lib/db';
import { tradingBots, botExecutions } from '../db/schema';
import { eq, and, gte, desc, asc, sql } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';
import { getRobozLogoBase64, getModelLogoBase64 } from '../lib/logos-base64';

export interface BotPerformanceData {
    botId: string;
    botName: string;
    aiModel: string | null;
    totalBalance: number | null;
    unrealizedPnl: number | null;
    accountBalance: number | null;
    dailyReturn: number | null; // Calculated from first to last execution of the day
    tradesExecuted: number;
    userId: string;
}

export interface DailyBotPerformance {
    topBot: BotPerformanceData | null;
    leastBot: BotPerformanceData | null;
}

/**
 * Get top and least performing bots for today
 */
export async function getDailyBotPerformance(
    db: DbClient,
    encryptionKey: string,
    pbkdf2Iterations: number
): Promise<DailyBotPerformance> {
    try {
        // Get all active bots
        const activeBots = await db
            .select()
            .from(tradingBots)
            .where(eq(tradingBots.status, 'active'))
            .all();

        if (activeBots.length === 0) {
            console.log('[X-TEST] No active bots found');
            return { topBot: null, leastBot: null };
        }

        console.log('[X-TEST] Found active bots:', activeBots.length);

        // Get yesterday's date (since we post at 8 AM about previous day's performance)
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);
        const yesterdayTimestamp = Math.floor(yesterday.getTime() / 1000);

        const today = new Date(yesterday);
        today.setUTCDate(today.getUTCDate() + 1);
        const todayTimestamp = Math.floor(today.getTime() / 1000);

        console.log('[X-TEST] Looking for executions between:', {
            yesterday: new Date(yesterdayTimestamp * 1000).toISOString(),
            today: new Date(todayTimestamp * 1000).toISOString(),
        });

        // Get bot performance for yesterday first
        const botPerformances = await Promise.all(
            activeBots.map(async (bot): Promise<BotPerformanceData | null> => {
                // Get first and last executions for yesterday
                // Use timestamp numbers directly for D1 queries (not Date objects)
                const firstExecutionYesterday = await db
                    .select({
                        totalBalance: botExecutions.totalBalance,
                        executionTime: botExecutions.executionTime,
                    })
                    .from(botExecutions)
                    .where(
                        and(
                            eq(botExecutions.botId, bot.id),
                            sql`${botExecutions.executionTime} >= ${yesterdayTimestamp}`,
                            sql`${botExecutions.executionTime} < ${todayTimestamp}`
                        )
                    )
                    .orderBy(asc(botExecutions.executionTime))
                    .limit(1)
                    .get();

                const lastExecutionYesterday = await db
                    .select({
                        totalBalance: botExecutions.totalBalance,
                        unrealizedPnl: botExecutions.unrealizedPnl,
                        accountBalance: botExecutions.accountBalance,
                        executionTime: botExecutions.executionTime,
                        tradesExecuted: botExecutions.tradesExecuted,
                    })
                    .from(botExecutions)
                    .where(
                        and(
                            eq(botExecutions.botId, bot.id),
                            sql`${botExecutions.executionTime} >= ${yesterdayTimestamp}`,
                            sql`${botExecutions.executionTime} < ${todayTimestamp}`
                        )
                    )
                    .orderBy(desc(botExecutions.executionTime))
                    .limit(1)
                    .get();

                const totalTradesYesterday = await db
                    .select({
                        totalTrades: sql<number>`COALESCE(SUM(${botExecutions.tradesExecuted}), 0)`
                    })
                    .from(botExecutions)
                    .where(
                        and(
                            eq(botExecutions.botId, bot.id),
                            sql`${botExecutions.executionTime} >= ${yesterdayTimestamp}`,
                            sql`${botExecutions.executionTime} < ${todayTimestamp}`
                        )
                    )
                    .get();

                if (!lastExecutionYesterday) {
                    return null;
                }

                // Calculate daily return
                const startBalance = firstExecutionYesterday?.totalBalance ?? lastExecutionYesterday.totalBalance ?? 100;
                const endBalance = lastExecutionYesterday.totalBalance ?? startBalance;
                const dailyReturn = startBalance > 0 ? ((endBalance - startBalance) / startBalance) * 100 : 0;

                return {
                    botId: bot.id,
                    botName: bot.name,
                    aiModel: bot.aiModel,
                    totalBalance: lastExecutionYesterday.totalBalance,
                    unrealizedPnl: lastExecutionYesterday.unrealizedPnl,
                    accountBalance: lastExecutionYesterday.accountBalance,
                    dailyReturn,
                    tradesExecuted: Number(totalTradesYesterday?.totalTrades ?? 0),
                    userId: bot.userId,
                };
            })
        );

        // Filter out null results and sort by daily return
        let validPerformances = botPerformances.filter((p): p is BotPerformanceData => p !== null);

        // If no bots found for yesterday, fall back to all-time performance
        if (validPerformances.length === 0) {
            console.log('[X-TEST] No bots found for yesterday, falling back to all-time performance');

            // Get all-time performance for all active bots
            const allTimePerformances = await Promise.all(
                activeBots.map(async (bot): Promise<BotPerformanceData | null> => {
                    // Get first execution (earliest)
                    const firstExecution = await db
                        .select({
                            totalBalance: botExecutions.totalBalance,
                            executionTime: botExecutions.executionTime,
                        })
                        .from(botExecutions)
                        .where(eq(botExecutions.botId, bot.id))
                        .orderBy(asc(botExecutions.executionTime))
                        .limit(1)
                        .get();

                    // Get last execution (latest)
                    const lastExecution = await db
                        .select({
                            totalBalance: botExecutions.totalBalance,
                            unrealizedPnl: botExecutions.unrealizedPnl,
                            accountBalance: botExecutions.accountBalance,
                            executionTime: botExecutions.executionTime,
                            tradesExecuted: botExecutions.tradesExecuted,
                        })
                        .from(botExecutions)
                        .where(eq(botExecutions.botId, bot.id))
                        .orderBy(desc(botExecutions.executionTime))
                        .limit(1)
                        .get();

                    const totalTradesAllTime = await db
                        .select({
                            totalTrades: sql<number>`COALESCE(SUM(${botExecutions.tradesExecuted}), 0)`
                        })
                        .from(botExecutions)
                        .where(eq(botExecutions.botId, bot.id))
                        .get();

                    if (!lastExecution) {
                        return null;
                    }

                    // Calculate all-time return
                    const startBalance = firstExecution?.totalBalance ?? lastExecution.totalBalance ?? 100;
                    const endBalance = lastExecution.totalBalance ?? startBalance;
                    const allTimeReturn = startBalance > 0 ? ((endBalance - startBalance) / startBalance) * 100 : 0;

                    return {
                        botId: bot.id,
                        botName: bot.name,
                        aiModel: bot.aiModel,
                        totalBalance: lastExecution.totalBalance,
                        unrealizedPnl: lastExecution.unrealizedPnl,
                        accountBalance: lastExecution.accountBalance,
                        dailyReturn: allTimeReturn, // Using dailyReturn field for all-time return
                        tradesExecuted: Number(totalTradesAllTime?.totalTrades ?? 0),
                        userId: bot.userId,
                    };
                })
            );

            validPerformances = allTimePerformances.filter((p): p is BotPerformanceData => p !== null);

            if (validPerformances.length === 0) {
                console.log('[X-TEST] No bots with executions found at all');
                return { topBot: null, leastBot: null };
            }

            console.log('[X-TEST] Found bots with all-time performance:', validPerformances.length);
        } else {
            console.log('[X-TEST] Found bots with yesterday performance:', validPerformances.length);
        }

        // Sort by return (daily or all-time)
        validPerformances.sort((a, b) => (b.dailyReturn ?? 0) - (a.dailyReturn ?? 0));

        const topBot = validPerformances[0];
        const leastBot = validPerformances[validPerformances.length - 1];

        console.log('[X-TEST] Performance summary:', {
            topBot: topBot ? { name: topBot.botName, return: topBot.dailyReturn } : null,
            leastBot: leastBot ? { name: leastBot.botName, return: leastBot.dailyReturn } : null,
        });

        return {
            topBot,
            leastBot: leastBot !== topBot ? leastBot : null, // Only include if different from top
        };
    } catch (error: any) {
        console.error('Error getting daily bot performance:', error);
        throw error;
    }
}

/**
 * Get Roboz logo as base64 data URL (from embedded base64 data)
 */
function getRobozLogo(): string {
    try {
        const base64 = getRobozLogoBase64();
        if (base64) {
            console.log('[X-TEST] Using embedded Roboz logo (PNG, base64 length:', base64.length, ')');
            return `data:image/png;base64,${base64}`;
        }
        console.warn('[X-TEST] Roboz logo not available in embedded data');
        return '';
    } catch (error) {
        console.warn('[X-TEST] Could not get Roboz logo:', error);
        return '';
    }
}

/**
 * Get AI model logo as base64 data URL (from embedded base64 data, converted from SVG to PNG)
 */
function getModelLogo(aiModel: string | null): string {
    if (!aiModel) return '';

    try {
        const base64 = getModelLogoBase64(aiModel);
        if (base64) {
            console.log('[X-TEST] Using embedded model logo (PNG) for', aiModel, '(base64 length:', base64.length, ')');
            return `data:image/png;base64,${base64}`;
        }
        console.warn(`[X-TEST] Model logo not available for ${aiModel}`);
        return '';
    } catch (error) {
        console.warn(`[X-TEST] Could not get model logo for ${aiModel}:`, error);
        return '';
    }
}

/**
 * Generate image using Google Gemini's native image generation with multi-image input
 * Uses gemini-2.5-flash-image model to generate images with actual logo images included
 * Following https://ai.google.dev/gemini-api/docs/image-generation#other_image_generation_modes
 */
export async function generateBotPerformanceImage(
    botData: BotPerformanceData,
    isTopPerformer: boolean,
    googleApiKey: string
): Promise<ArrayBuffer> {
    try {
        // Get logo images (now synchronous, no async fetch needed)
        const robozLogo = getRobozLogo();
        const modelLogo = getModelLogo(botData.aiModel);

        // Create prompt for image generation
        const performanceText = isTopPerformer ? 'Top Performer' : 'Least Performer';
        const returnText = botData.dailyReturn
            ? `${botData.dailyReturn > 0 ? '+' : ''}${botData.dailyReturn.toFixed(2)}%`
            : 'N/A';

        // Build contents array with text prompt and logo images
        // Using Gemini's multi-image input capability to include actual logos
        const contents: any[] = [
            {
                text: `Create an engaging social media image for ${performanceText} bot performance report.

Design Requirements:
- Background: Dark modern gradient (black to dark blue)
- Center: Large text showing "${performanceText}" in bold white text
- Below title: Bot name "${botData.botName}" in medium size
- Below bot name: Daily return "${returnText}" in ${botData.dailyReturn && botData.dailyReturn > 0 ? 'green' : 'red'} color
- Bottom: Balance ${botData.totalBalance?.toFixed(2) || 'N/A'} USDT in smaller text
- Background: Subtle chart/graph elements
- Style: Modern, professional trading/crypto aesthetic

Logo Placement:
- Use the RobozTrade logo image provided and place it in the top left corner. Keep its original colors, text, and design intact.
- Use the AI model logo image provided and place it in the top right corner. Keep its original colors, icons, and design intact.
- Both logos should be clearly visible and maintain their original appearance.

Ensure high-fidelity text rendering for all text elements and accurate logo placement.`,
            },
        ];

        // Add Roboz logo if available and valid
        if (robozLogo && robozLogo.includes('base64,')) {
            try {
                const base64Data = robozLogo.split(',')[1];
                // Validate base64 length (should be reasonable)
                if (base64Data && base64Data.length > 0 && base64Data.length < 5000000) { // Max 5MB
                    contents.push({
                        inlineData: {
                            mimeType: 'image/png',
                            data: base64Data,
                        },
                    });
                    console.log('[X-TEST] Added Roboz logo to Gemini image generation request');
                } else {
                    console.warn('[X-TEST] Roboz logo base64 data invalid or too large');
                }
            } catch (error) {
                console.warn('[X-TEST] Error processing Roboz logo:', error);
            }
        }

        // Add model logo if available and valid
        if (modelLogo && modelLogo.includes('base64,')) {
            try {
                const base64Data = modelLogo.split(',')[1];
                // Validate base64 length (should be reasonable)
                if (base64Data && base64Data.length > 0 && base64Data.length < 5000000) { // Max 5MB
                    contents.push({
                        inlineData: {
                            mimeType: 'image/png',
                            data: base64Data,
                        },
                    });
                    console.log('[X-TEST] Added model logo (PNG) to Gemini image generation request');
                } else {
                    console.warn('[X-TEST] Model logo base64 data invalid or too large');
                }
            } catch (error) {
                console.warn('[X-TEST] Error processing model logo:', error);
            }
        }

        // Use Gemini's native image generation with multi-image input
        // Following https://ai.google.dev/gemini-api/docs/image-generation
        console.log('[X-TEST] Generating image using Gemini native image generation (gemini-2.5-flash-image)');
        console.log('[X-TEST] Contents parts:', contents.length, '(1 text +', contents.length - 1, 'images)');

        const ai = new GoogleGenAI({ apiKey: googleApiKey });

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', // Gemini's native image generation model
                contents: contents,
                config: {
                    imageConfig: {
                        aspectRatio: '16:9', // Twitter/X standard aspect ratio
                    },
                },
            });

            console.log('[X-TEST] Gemini image generation response received:', {
                hasCandidates: !!response.candidates,
                candidatesCount: response.candidates?.length || 0,
            });

            // Extract generated image from response
            // According to docs: response.candidates[0].content.parts[] where parts have inlineData
            if (response.candidates && response.candidates.length > 0) {
                const candidate = response.candidates[0];

                if (candidate.content?.parts) {
                    console.log('[X-TEST] Candidate parts count:', candidate.content.parts.length);

                    for (const part of candidate.content.parts) {
                        // Check for image data (inlineData)
                        if (part.inlineData) {
                            const imageData = part.inlineData.data;
                            const mimeType = part.inlineData.mimeType || 'image/png';

                            console.log('[X-TEST] Found generated image:', {
                                mimeType,
                                dataLength: imageData?.length || 0,
                            });

                            if (imageData) {
                                // Convert base64 to ArrayBuffer
                                const binaryString = atob(imageData);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }

                                console.log('[X-TEST] Image generated successfully, size:', bytes.length, 'bytes');
                                return bytes.buffer;
                            }
                        }

                        // Check for text (model might return text explaining the image)
                        if (part.text) {
                            console.log('[X-TEST] Response includes text:', part.text.substring(0, 100));
                        }
                    }
                }

                console.error('[X-TEST] No image data found in response parts');
            }

            throw new Error('No image generated in Gemini response');
        } catch (error: any) {
            console.error('[X-TEST] Gemini image generation error:', error);

            // Provide helpful error message
            if (error.message?.includes('404') || error.message?.includes('not found')) {
                throw new Error(
                    `Gemini image generation model not found. Please check that:\n` +
                    `1. The model 'gemini-2.5-flash-image' is available in your region\n` +
                    `2. Your API key has access to image generation features\n` +
                    `Original error: ${error.message}`
                );
            }

            throw error;
        }
    } catch (error: any) {
        console.error('Error generating image with Gemini:', error);
        throw error;
    }
}

/**
 * Get model logo path based on AI model name
 */
function getModelLogoPath(aiModel: string): string {
    const modelLogoMap: Record<string, string> = {
        'openai/gpt-5': '/logos/openai.svg',
        'openai/gpt-5-mini': '/logos/openai.svg',
        'openai/o3': '/logos/openai.svg',
        'openai/gpt-oss-120b': '/logos/openai.svg',
        'anthropic/claude-4.5-sonnet': '/logos/claude.svg',
        'anthropic/claude-3.5-sonnet': '/logos/claude.svg',
        'google/gemini-2.5-pro': '/logos/gemini.svg',
        'google/gemini-2.5-flash': '/logos/gemini.svg',
        'google/gemma-3-27b-it': '/logos/gemini.svg',
        'meta-llama/llama-4-scout': '/logos/meta.svg',
        'meta-llama/llama-4-maverick': '/logos/meta.svg',
        'deepseek/deepseek-v3.1-terminus': '/logos/deepseek.svg',
        'deepseek/deepseek-r1': '/logos/deepseek.svg',
        'qwen/qwen-2.5-72b-instruct': '/logos/qwen.svg',
        'mistralai/mistral-large': '/logos/mistral.svg',
        'x-ai/grok-4': '/logos/xai.svg',
        'cohere/command-r-plus': '/logos/cohere.svg',
        'perplexity/sonar-pro': '/logos/perplexity.svg',
    };

    return modelLogoMap[aiModel] || '/logos/gemini.svg'; // Default to gemini logo
}

/**
 * Generate tweet text using AI SDK generateText function
 * Following https://ai-sdk.dev/docs/ai-sdk-core/generating-text
 */
export async function generateTweetText(
    botData: BotPerformanceData,
    isTopPerformer: boolean,
    openRouterApiKey: string
): Promise<string> {
    try {
        const openrouter = createOpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: openRouterApiKey,
            headers: {
                'HTTP-Referer': 'https://roboz.trade',
                'X-Title': 'RobozTrade AI Trading Bot',
            },
        });

        const returnText = botData.dailyReturn
            ? `${botData.dailyReturn > 0 ? '+' : ''}${botData.dailyReturn.toFixed(2)}%`
            : 'N/A';

        const balanceText = botData.totalBalance?.toFixed(2) || 'N/A';

        // Use AI SDK generateText as per documentation
        const { text } = await generateText({
            model: openrouter('google/gemini-2.5-flash'),
            system: 'You are a social media content creator for a cryptocurrency AI trading platform. Create engaging, authentic, and professional Twitter/X posts.',
            prompt: `Create an engaging Twitter/X post for a ${isTopPerformer ? 'top performing' : 'least performing'} AI trading bot.

Bot Details:
- Name: ${botData.botName}
- AI Model: ${botData.aiModel || 'Unknown'}
- Daily Return: ${returnText}
- Balance: ${balanceText} USDT
- Trades Executed: ${botData.tradesExecuted}

Requirements:
- Keep it under 280 characters (Twitter limit)
- ${isTopPerformer ? 'Celebrate the performance with enthusiasm' : 'Mention the performance objectively, focus on transparency'}
- Include relevant emoji (1-2 max)
- Add hashtags: #AITrading #Crypto #RobozTrade
- Make it engaging and authentic
- No markdown, just plain text
- Include a call to action to check out RobozTrade

Respond with ONLY the tweet text, nothing else.`,
        });

        // Clean up the response (remove any markdown or extra formatting)
        let tweetText = text.trim();

        // Remove markdown code blocks if present
        tweetText = tweetText.replace(/```[\w]*\n]*/g, '').replace(/```/g, '').trim();

        // Ensure it's within Twitter limit
        if (tweetText.length > 280) {
            tweetText = tweetText.substring(0, 277) + '...';
        }

        return tweetText;
    } catch (error: any) {
        console.error('Error generating tweet text:', error);
        throw error;
    }
}

/**
 * Upload media to X/Twitter and get media ID
 */
async function uploadMediaToTwitter(
    imageBuffer: ArrayBuffer,
    twitterApiKey: string,
    twitterApiSecret: string,
    twitterAccessToken: string,
    twitterAccessTokenSecret: string
): Promise<string> {
    try {
        // X/Twitter API v1.1 media upload endpoint requires OAuth 1.0a
        // Convert ArrayBuffer to blob for FormData
        const blob = new Blob([imageBuffer], { type: 'image/png' });
        const formData = new FormData();
        formData.append('media', blob, 'bot-performance.png');

        const oauthHeaders = await generateOAuthHeaders(
            'POST',
            'https://upload.twitter.com/1.1/media/upload.json',
            {
                oauth_consumer_key: twitterApiKey,
                oauth_token: twitterAccessToken,
                oauth_signature_method: 'HMAC-SHA1',
                oauth_version: '1.0',
                oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
                oauth_nonce: generateNonce(),
            },
            twitterApiSecret,
            twitterAccessTokenSecret
        );

        const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
            method: 'POST',
            headers: oauthHeaders,
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Twitter media upload failed: ${response.status} ${errorText}`);
        }

        const data = await response.json() as any;
        return data.media_id_string;
    } catch (error: any) {
        console.error('Error uploading media to Twitter:', error);
        throw error;
    }
}

/**
 * Post tweet to X/Twitter
 */
export async function postTweetToX(
    tweetText: string,
    imageBuffer: ArrayBuffer | null,
    twitterApiKey: string,
    twitterApiSecret: string,
    twitterAccessToken: string,
    twitterAccessTokenSecret: string
): Promise<string> {
    try {
        let mediaId: string | undefined;

        // Upload image if provided
        if (imageBuffer) {
            mediaId = await uploadMediaToTwitter(
                imageBuffer,
                twitterApiKey,
                twitterApiSecret,
                twitterAccessToken,
                twitterAccessTokenSecret
            );
        }

        // Post tweet using Twitter API v2
        // Twitter API v2 supports both OAuth 1.0a and OAuth 2.0
        // OAuth 1.0a requires proper app permissions (Read and Write permissions)
        const tweetData: any = {
            text: tweetText,
        };

        // Add media if available (Twitter API v2 format)
        if (mediaId) {
            tweetData.media = {
                media_ids: [mediaId],
            };
        }

        // Use OAuth 1.0a for Twitter API v2 posting
        // Note: Your Twitter app must have "Read and Write" permissions
        // If you get 403 OAuth1 permissions error, check your app settings at:
        // https://developer.twitter.com/en/portal/projects
        const oauthHeaders = await generateOAuthHeaders(
            'POST',
            'https://api.twitter.com/2/tweets',
            {
                oauth_consumer_key: twitterApiKey,
                oauth_token: twitterAccessToken,
                oauth_signature_method: 'HMAC-SHA1',
                oauth_version: '1.0',
                oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
                oauth_nonce: generateNonce(),
            },
            twitterApiSecret,
            twitterAccessTokenSecret
        );

        console.log('[X-TEST] Posting tweet with OAuth 1.0a headers');
        const response = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                ...oauthHeaders,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tweetData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Twitter API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as any;
        return data.data?.id || 'unknown';
    } catch (error: any) {
        console.error('Error posting tweet:', error);
        throw error;
    }
}

/**
 * Generate OAuth 1.0a headers for Twitter API using Web Crypto API
 */
async function generateOAuthHeaders(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string
): Promise<Record<string, string>> {
    const oauthParams = { ...params };

    // Create signature base string
    const parameterString = Object.keys(oauthParams)
        .sort()
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
        .join('&');

    const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(parameterString)}`;

    // Create signing key
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

    // Generate signature using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingKey);
    const messageData = encoder.encode(signatureBaseString);

    // Import key for HMAC
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    // Sign the message
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);

    // Convert to base64
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureBytes = String.fromCharCode(...signatureArray);
    const signature = btoa(signatureBytes);

    oauthParams.oauth_signature = signature;

    // Create authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
        .sort()
        .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');

    return {
        'Authorization': authHeader,
    };
}

/**
 * Generate random nonce for OAuth
 */
function generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Main function to create and post daily X/Twitter posts
 */
export async function createDailyXPosts(
    db: DbClient,
    encryptionKey: string,
    pbkdf2Iterations: number,
    openRouterApiKey: string,
    googleApiKey: string,
    twitterApiKey: string,
    twitterApiSecret: string,
    twitterAccessToken: string,
    twitterAccessTokenSecret: string
): Promise<{
    topBotPost: { success: boolean; tweetId?: string; error?: string };
    leastBotPost: { success: boolean; tweetId?: string; error?: string };
}> {
    try {
        // Get daily bot performance
        const { topBot, leastBot } = await getDailyBotPerformance(db, encryptionKey, pbkdf2Iterations);

        const results = {
            topBotPost: { success: false } as { success: boolean; tweetId?: string; error?: string },
            leastBotPost: { success: false } as { success: boolean; tweetId?: string; error?: string },
        };

        // Post top performer
        if (topBot) {
            try {
                let imageBuffer: ArrayBuffer | null = null;
                try {
                    imageBuffer = await generateBotPerformanceImage(topBot, true, googleApiKey);
                } catch (imageError: any) {
                    console.warn('Failed to generate image, posting without image:', imageError.message);
                    // Continue without image
                }

                const tweetText = await generateTweetText(topBot, true, openRouterApiKey);
                const tweetId = await postTweetToX(
                    tweetText,
                    imageBuffer,
                    twitterApiKey,
                    twitterApiSecret,
                    twitterAccessToken,
                    twitterAccessTokenSecret
                );
                results.topBotPost = { success: true, tweetId };
                console.log(`Top bot post successful: ${tweetId}`);
            } catch (error: any) {
                console.error('Error posting top bot:', error);
                results.topBotPost = { success: false, error: error.message };
            }
        }

        // Post least performer (if different from top)
        if (leastBot && leastBot.botId !== topBot?.botId) {
            try {
                let imageBuffer: ArrayBuffer | null = null;
                try {
                    imageBuffer = await generateBotPerformanceImage(leastBot, false, googleApiKey);
                } catch (imageError: any) {
                    console.warn('Failed to generate image, posting without image:', imageError.message);
                    // Continue without image
                }

                const tweetText = await generateTweetText(leastBot, false, openRouterApiKey);
                const tweetId = await postTweetToX(
                    tweetText,
                    imageBuffer,
                    twitterApiKey,
                    twitterApiSecret,
                    twitterAccessToken,
                    twitterAccessTokenSecret
                );
                results.leastBotPost = { success: true, tweetId };
                console.log(`Least bot post successful: ${tweetId}`);
            } catch (error: any) {
                console.error('Error posting least bot:', error);
                results.leastBotPost = { success: false, error: error.message };
            }
        }

        return results;
    } catch (error: any) {
        console.error('Error creating daily X posts:', error);
        throw error;
    }
}

