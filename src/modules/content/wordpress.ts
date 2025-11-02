import WpApiClient from 'wordpress-api-client';
import { createWordPressCircuitBreaker } from '@/lib/resilience';
import { wordpressRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { wordpressSettingsTable } from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * WordPress API Client with Reliability Infrastructure
 *
 * Features:
 * - Circuit breaker to prevent hammering failing API
 * - Rate limiting (50 posts/hour)
 * - Structured logging
 * - Automatic error handling
 * - User-specific configuration
 */

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressPostData {
  title: string;
  content: string;
  excerpt?: string;
  status?: 'draft' | 'publish' | 'pending' | 'future';
}

/**
 * Get WordPress configuration for a user
 */
export async function getWordPressConfig(userId: string): Promise<WordPressConfig | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = await (db as any)
      .select()
      .from(wordpressSettingsTable)
      .where(eq(wordpressSettingsTable.userId, userId))
      .limit(1);

    if (settings.length === 0) {
      return null;
    }

    const setting = settings[0];
    return {
      siteUrl: setting.siteUrl,
      username: setting.username,
      applicationPassword: setting.applicationPassword,
    };
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get WordPress config');
    return null;
  }
}

/**
 * Create WordPress client for a user
 */
export function createWordPressClient(config: WordPressConfig): WpApiClient {
  logger.info({ siteUrl: config.siteUrl }, 'Initializing WordPress client');

  return new WpApiClient(config.siteUrl, {
    auth: {
      type: 'basic',
      username: config.username,
      password: config.applicationPassword,
    },
  });
}

/**
 * Create a new WordPress post (internal, unprotected)
 */
async function createPostInternal(config: WordPressConfig, postData: WordPressPostData) {
  logger.info(
    {
      siteUrl: config.siteUrl,
      title: postData.title,
      status: postData.status
    },
    'Creating WordPress post'
  );

  const client = createWordPressClient(config);

  // Create the post with proper typed structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post: any = await client.post().create({
    title: {
      rendered: postData.title,
    },
    content: {
      rendered: postData.content,
      protected: false,
    },
    excerpt: postData.excerpt ? {
      rendered: postData.excerpt,
      protected: false,
    } : undefined,
    status: postData.status || 'draft',
  });

  logger.info(
    {
      postId: post.id,
      url: post.link,
      status: post.status
    },
    'WordPress post created successfully'
  );

  return post;
}

/**
 * Create a new WordPress post (protected with circuit breaker + rate limiting)
 */
const createPostWithBreaker = createWordPressCircuitBreaker(createPostInternal);
export const createPost = withRateLimit(
  (config: WordPressConfig, postData: WordPressPostData) =>
    createPostWithBreaker.fire(config, postData),
  wordpressRateLimiter
);

/**
 * Update an existing post (internal, unprotected)
 */
async function updatePostInternal(
  config: WordPressConfig,
  postId: number,
  postData: Partial<WordPressPostData>
) {
  logger.info({ postId, siteUrl: config.siteUrl }, 'Updating WordPress post');

  const client = createWordPressClient(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post: any = await client.post(postId).update({
    title: postData.title
      ? {
          rendered: postData.title,
        }
      : undefined,
    content: postData.content
      ? {
          rendered: postData.content,
          protected: false,
        }
      : undefined,
    excerpt: postData.excerpt
      ? {
          rendered: postData.excerpt,
          protected: false,
        }
      : undefined,
    status: postData.status,
  });

  logger.info(
    { postId: post.id, url: post.link, status: post.status },
    'WordPress post updated successfully'
  );

  return post;
}

/**
 * Update an existing post (protected with circuit breaker + rate limiting)
 */
const updatePostWithBreaker = createWordPressCircuitBreaker(updatePostInternal);
export const updatePost = withRateLimit(
  (config: WordPressConfig, postId: number, postData: Partial<WordPressPostData>) =>
    updatePostWithBreaker.fire(config, postId, postData),
  wordpressRateLimiter
);

/**
 * Get posts (internal, unprotected)
 */
async function getPostsInternal(
  config: WordPressConfig,
  options?: {
    per_page?: number;
    page?: number;
    status?: string;
    order?: 'asc' | 'desc';
    orderby?: string;
  }
) {
  logger.info({ siteUrl: config.siteUrl, options }, 'Fetching WordPress posts');

  const client = createWordPressClient(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts: any = await client.post().get(options);

  logger.info(
    { siteUrl: config.siteUrl, postsCount: posts.length },
    'WordPress posts fetched successfully'
  );

  return posts;
}

/**
 * Get posts (protected with circuit breaker + rate limiting)
 */
const getPostsWithBreaker = createWordPressCircuitBreaker(getPostsInternal);
export const getPosts = withRateLimit(
  (
    config: WordPressConfig,
    options?: {
      per_page?: number;
      page?: number;
      status?: string;
      order?: 'asc' | 'desc';
      orderby?: string;
    }
  ) => getPostsWithBreaker.fire(config, options),
  wordpressRateLimiter
);

/**
 * Get a single post by ID (internal, unprotected)
 */
async function getPostByIdInternal(config: WordPressConfig, postId: number) {
  logger.info({ siteUrl: config.siteUrl, postId }, 'Fetching WordPress post by ID');

  const client = createWordPressClient(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post: any = await client.post(postId).get();

  logger.info(
    { postId: post.id, title: post.title.rendered },
    'WordPress post fetched successfully'
  );

  return post;
}

/**
 * Get a single post by ID (protected with circuit breaker + rate limiting)
 */
const getPostByIdWithBreaker = createWordPressCircuitBreaker(getPostByIdInternal);
export const getPostById = withRateLimit(
  (config: WordPressConfig, postId: number) =>
    getPostByIdWithBreaker.fire(config, postId),
  wordpressRateLimiter
);

/**
 * Delete a post (internal, unprotected)
 */
async function deletePostInternal(
  config: WordPressConfig,
  postId: number,
  force = false
) {
  logger.info({ siteUrl: config.siteUrl, postId, force }, 'Deleting WordPress post');

  const client = createWordPressClient(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await client.post(postId).delete({ force });

  logger.info({ postId }, 'WordPress post deleted successfully');

  return result;
}

/**
 * Delete a post (protected with circuit breaker + rate limiting)
 */
const deletePostWithBreaker = createWordPressCircuitBreaker(deletePostInternal);
export const deletePost = withRateLimit(
  (config: WordPressConfig, postId: number, force = false) =>
    deletePostWithBreaker.fire(config, postId, force),
  wordpressRateLimiter
);

/**
 * Upload media (internal, unprotected)
 */
async function uploadMediaInternal(
  config: WordPressConfig,
  file: {
    name: string;
    data: Buffer | string; // Base64 string or Buffer
    type: string; // MIME type
  },
  metadata?: {
    alt_text?: string;
    caption?: string;
    description?: string;
  }
) {
  logger.info(
    { siteUrl: config.siteUrl, fileName: file.name },
    'Uploading media to WordPress'
  );

  const client = createWordPressClient(config);

  // Convert Buffer to base64 if needed
  const fileData =
    typeof file.data === 'string' ? file.data : file.data.toString('base64');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const media: any = await client.media().create({
    file: fileData,
    filename: file.name,
    content_type: file.type,
    ...metadata,
  });

  logger.info(
    { mediaId: media.id, url: media.source_url },
    'Media uploaded to WordPress successfully'
  );

  return media;
}

/**
 * Upload media (protected with circuit breaker + rate limiting)
 */
const uploadMediaWithBreaker = createWordPressCircuitBreaker(uploadMediaInternal);
export const uploadMedia = withRateLimit(
  (
    config: WordPressConfig,
    file: {
      name: string;
      data: Buffer | string;
      type: string;
    },
    metadata?: {
      alt_text?: string;
      caption?: string;
      description?: string;
    }
  ) => uploadMediaWithBreaker.fire(config, file, metadata),
  wordpressRateLimiter
);

/**
 * Get categories (internal, unprotected)
 */
async function getCategoriesInternal(
  config: WordPressConfig,
  options?: {
    per_page?: number;
    page?: number;
  }
) {
  logger.info({ siteUrl: config.siteUrl }, 'Fetching WordPress categories');

  const client = createWordPressClient(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories: any = await client.category().get(options);

  logger.info(
    { categoriesCount: categories.length },
    'WordPress categories fetched successfully'
  );

  return categories;
}

/**
 * Get categories (protected with circuit breaker + rate limiting)
 */
const getCategoriesWithBreaker = createWordPressCircuitBreaker(getCategoriesInternal);
export const getCategories = withRateLimit(
  (
    config: WordPressConfig,
    options?: {
      per_page?: number;
      page?: number;
    }
  ) => getCategoriesWithBreaker.fire(config, options),
  wordpressRateLimiter
);

/**
 * Create a category (internal, unprotected)
 */
async function createCategoryInternal(
  config: WordPressConfig,
  categoryData: {
    name: string;
    description?: string;
    slug?: string;
    parent?: number;
  }
) {
  logger.info(
    { siteUrl: config.siteUrl, categoryName: categoryData.name },
    'Creating WordPress category'
  );

  const client = createWordPressClient(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const category: any = await client.category().create(categoryData);

  logger.info(
    { categoryId: category.id, categoryName: category.name },
    'WordPress category created successfully'
  );

  return category;
}

/**
 * Create a category (protected with circuit breaker + rate limiting)
 */
const createCategoryWithBreaker = createWordPressCircuitBreaker(createCategoryInternal);
export const createCategory = withRateLimit(
  (
    config: WordPressConfig,
    categoryData: {
      name: string;
      description?: string;
      slug?: string;
      parent?: number;
    }
  ) => createCategoryWithBreaker.fire(config, categoryData),
  wordpressRateLimiter
);
