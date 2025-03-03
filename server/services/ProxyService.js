const axios = require('axios');

/**
 * Service to handle API proxying
 */
class ProxyService {
  constructor() {
    // Flag to indicate if we're running in Docker
    this.isDocker = process.env.DOCKER_ENV === 'true';
  }
  
  /**
   * Process URLs for Docker compatibility
   * 
   * @param {string} url The original URL
   * @returns {string} The processed URL
   */
  processUrl(url) {
    if (!this.isDocker) return url;
    
    // In Docker, we need to convert localhost references to host.docker.internal
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return url.replace(/(localhost|127\.0\.0\.1)/, 'host.docker.internal');
    }
    
    return url;
  }
  
  /**
   * Forward a request through the proxy
   * 
   * @param {Object} options Request options
   * @param {string} options.url Target URL
   * @param {string} options.method HTTP method
   * @param {Object} options.data Request body data
   * @param {Object} options.params URL parameters
   * @param {Object} options.headers HTTP headers
   * @returns {Promise<Object>} Response data
   */
  async proxyRequest(options) {
    // Process the URL for Docker compatibility
    const processedUrl = this.processUrl(options.url);
    console.log(`Processing proxy request: ${options.url} -> ${processedUrl}`);
    
    const requestOptions = {
      ...options,
      url: processedUrl,
      // Removed timeout to allow models time to complete responses
      validateStatus: function (status) {
        // Accept all status codes to handle them properly
        return true;
      }
    };
    
    try {
      const response = await axios(requestOptions);
      return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      console.error('Error in proxy service:', error.message);
      
      // Provide a more detailed error message for network issues
      if (error.code === 'ECONNREFUSED' && (options.url.includes('localhost') || options.url.includes('127.0.0.1'))) {
        throw {
          error: 'Connection refused to local service',
          message: 'Unable to connect to your local service. Make sure it is running and accessible.',
          code: error.code,
          data: null,
          status: 502
        };
      }
      
      throw {
        error: error.message,
        data: error.response?.data || null,
        status: error.response?.status || 500,
        code: error.code
      };
    }
  }
}

module.exports = new ProxyService();