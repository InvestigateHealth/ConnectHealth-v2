// src/services/RetryService.js
// Utility service for retrying failed operations

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn - Function to retry
 * @param {Object} options - Configuration options
 * @returns {Promise} Result of the function
 */
export const withRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 300,
    maxDelay = 5000,
    factor = 2,
    retryCondition = () => true,
    onRetry = null,
    timeout = 15000
  } = options;
  
  let retries = 0;
  let delay = initialDelay;
  
  // Create a timeout promise
  const timeoutPromise = timeout > 0 
    ? new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      ) 
    : null;
  
  while (true) {
    try {
      // If timeout is enabled, race the operation against a timeout
      if (timeoutPromise) {
        return await Promise.race([fn(), timeoutPromise]);
      } else {
        return await fn();
      }
    } catch (error) {
      // Check if we should retry based on the error
      if (!retryCondition(error) || retries >= maxRetries) {
        throw error;
      }
      
      retries++;
      
      // Calculate next delay with exponential backoff and some jitter
      const jitter = 0.1 * delay * Math.random();
      delay = Math.min(delay * factor + jitter, maxDelay);
      
      // Notify if a callback was provided
      if (onRetry) {
        onRetry(retries, delay, error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Determine if an error is retriable based on common criteria
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} Whether the error is retriable
 */
export const isRetriableError = (error) => {
  // Network connectivity errors are usually temporary
  if (error.message?.includes('network') || 
      error.message?.includes('connect') ||
      error.message?.includes('timeout') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT')) {
    return true;
  }
  
  // Firebase/Firestore specific errors that may be temporary
  if (error.code) {
    // Firebase error codes that are typically temporary
    const retriableCodes = [
      'unavailable',
      'deadline-exceeded',
      'cancelled',
      'resource-exhausted',
      'internal',
      'data-loss',
      'aborted',
      'storage/retry-limit-exceeded',
      'storage/server-file-wrong-size'
    ];
    
    return retriableCodes.includes(error.code);
  }
  
  // HTTP status codes that warrant a retry (server errors, rate limiting)
  if (error.status) {
    return (
      error.status >= 500 || // Server errors
      error.status === 429 || // Too many requests
      error.status === 408 // Request timeout
    );
  }
  
  // Default to not retrying for unrecognized errors
  return false;
};

/**
 * Retry a function with exponential backoff only for retriable errors
 * 
 * @param {Function} fn - Function to retry
 * @param {Object} options - Configuration options
 * @returns {Promise} Result of the function
 */
export const withSmartRetry = (fn, options = {}) => {
  return withRetry(fn, {
    retryCondition: isRetriableError,
    ...options
  });
};

/**
 * Retry decorator for class methods
 * 
 * @param {Object} options - Retry options
 * @returns {Function} Decorator function
 */
export const retryDecorator = (options = {}) => {
  return (target, key, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };
    
    return descriptor;
  };
};

/**
 * Batch operations with retry capability
 * 
 * @param {Array} items - Array of items to process
 * @param {Function} processFn - Function to process each item
 * @param {Object} options - Retry and batch options
 * @returns {Promise<Array>} Array of results and errors
 */
export const batchWithRetry = async (items, processFn, options = {}) => {
  const {
    batchSize = 10,
    batchDelay = 0,
    retryOptions = {}
  } = options;
  
  const results = [];
  const errors = [];
  
  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch items in parallel
    const batchPromises = batch.map(async (item, index) => {
      try {
        const result = await withRetry(() => processFn(item, i + index), retryOptions);
        return { success: true, result, item };
      } catch (error) {
        return { success: false, error, item };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Separate successes and failures
    batchResults.forEach(result => {
      if (result.success) {
        results.push(result.result);
      } else {
        errors.push({ item: result.item, error: result.error });
      }
    });
    
    // Add a delay between batches if specified
    if (batchDelay > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  return { results, errors };
};

/**
 * Create a rate limited function with retry
 * 
 * @param {Function} fn - Function to rate limit
 * @param {Object} options - Rate limit and retry options
 * @returns {Function} Rate limited function
 */
export const createRateLimitedFunction = (fn, options = {}) => {
  const {
    maxCalls = 10,
    interval = 1000,
    retryOptions = {}
  } = options;
  
  let callsMade = 0;
  let resetTimeout = null;
  const queue = [];
  
  const resetCalls = () => {
    callsMade = 0;
    resetTimeout = null;
    processQueue();
  };
  
  const processQueue = () => {
    if (queue.length === 0) return;
    
    if (callsMade < maxCalls) {
      const { args, resolve, reject } = queue.shift();
      
      callsMade++;
      if (!resetTimeout) {
        resetTimeout = setTimeout(resetCalls, interval);
      }
      
      // Execute function with retry capabilities
      withRetry(() => fn(...args), retryOptions)
        .then(resolve)
        .catch(reject)
        .finally(processQueue);
    }
  };
  
  return (...args) => {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });
      processQueue();
    });
  };
};
