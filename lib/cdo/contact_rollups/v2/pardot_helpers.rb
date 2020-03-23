module PardotHelpers
  class InvalidApiKeyException < RuntimeError
  end

  PARDOT_AUTHENTICATION_URL = "https://pi.pardot.com/api/login/version/4".freeze
  PARDOT_SUCCESS_HTTP_CODES = %w(200 201 204).freeze

  private

  # Login to Pardot and request an API key. The API key is valid for (up to) one
  # hour, after which it will become invalid and we will need to request a new
  # one.
  # @return [String] API key to use for subsequent requests
  def request_pardot_api_key
    puts "Requesting new API key"
    doc = post_request(
      PARDOT_AUTHENTICATION_URL,
      {
        email: CDO.pardot_username,
        password: CDO.pardot_password,
        user_key: CDO.pardot_user_key
      }
    )

    status = doc.xpath('/rsp/@stat').text
    if status != "ok"
      raise "Pardot authentication response failed with status #{status}  #{doc}"
    end

    api_key = doc.xpath('/rsp/api_key').text
    raise "Pardot authentication response did not include api_key" if api_key.nil?

    $pardot_api_key = api_key
  end

  # Make an API request with Pardot authentication, including appending auth
  # params and refreshing Pardot API key and retrying if necessary.
  # @param url [String] URL to post to
  # @return [Nokogiri::XML, nil] XML response from Pardot
  def post_with_auth_retry(url)
    post_request_with_auth(url)
  rescue InvalidApiKeyException
    # If we fail with an invalid key, that probably means our API key (which is
    # good for one hour) has expired. Try one time to request a new API key and
    # try the post again. If that fails, that is a fatal error.
    request_pardot_api_key
    post_request_with_auth(url)
  end

  # Make an API request with Pardot authentication
  # @param url [String] URL to post to. The URL passed in should not contain
  #   auth params, as auth params will get appended in this method.
  # @return [Nokogiri::XML] XML response from Pardot
  def post_request_with_auth(url)
    request_pardot_api_key if $pardot_api_key.nil?

    # add the API key and user key parameters to body of the POST request
    post_request(
      url,
      {
        api_key: $pardot_api_key,
        user_key: CDO.pardot_user_key
      }
    )
  end

  # Make an API request. This method may raise exceptions.
  # @param url [String] URL to post to - must already include Pardot auth params
  #   in query string
  # @param params [Hash] hash of POST params (may be empty hash)
  # @return [Nokogiri::XML, nil] XML response from Pardot
  def post_request(url, params)
    uri = URI(url)

    response = Net::HTTP.post_form(uri, params)

    # Do common error handling for Pardot response.
    unless PARDOT_SUCCESS_HTTP_CODES.include?(response.code)
      raise "Pardot request failed with HTTP #{response.code}"
    end

    if response.code == '204'
      return nil
    end

    doc = Nokogiri::XML(response.body, &:noblanks)
    raise "Pardot response did not return parsable XML" if doc.nil?

    error_details = doc.xpath('/rsp/err').text
    raise InvalidApiKeyException if error_details.include? "Invalid API key or user key"

    status = doc.xpath('/rsp/@stat').text
    raise "Pardot response did not include status" if status.nil?

    doc
  end

  # Parse a Pardot XML response and raise an exception on the first error
  # if there is one.
  # @param doc [Nokogiri::XML] XML response from Pardot
  def raise_if_response_error(doc)
    status = doc.xpath('/rsp/@stat').text
    if status != "ok"
      error_text = doc.xpath('/rsp/errors/*').first.try(:text)
      error_text = "Unknown error" if error_text.nil? || error_text.empty?
      puts doc.to_s
      puts error_text
      raise "Error in Pardot response: #{error_text}"
    end
  end
end
