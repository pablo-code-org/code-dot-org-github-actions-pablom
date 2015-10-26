require 'minitest/autorun'
require_relative '../../deployment'
require_relative '../../lib/cdo/aws/cloudfront'
require 'active_support/core_ext/hash/except'

# These unit tests simply confirm that the #create_or_update method will pass
# properly-structured data to the AWS CloudFront Client library.
# Separate integration tests are required to guarantee that the live API
# endpoints will accept the values provided.
class TestCloudFront < Minitest::Test
  def setup
    @old_stub_responses = Aws.config[:stub_responses]
    Aws.config[:stub_responses] = true
    Aws.config[:cloudfront] = {
      stub_responses: {
        # Allow #wait_until methods to finish
        get_distribution: Aws::CloudFront::Client.new.
          get_distribution(id: 'string').data.
          tap { |x| x[:distribution][:status] = 'Deployed' }
      }
    }
  end
  def teardown
    Aws.config[:stub_responses] = @old_stub_responses
  end

  def distribution_list(items=[])
    {
      distribution_list: {
        marker: '',
        max_items: 0,
        quantity: items.length,
        is_truncated: false,
        items: items
      }
    }
  end

  def test_cloudfront_create
    Aws.config[:cloudfront][:stub_responses][:list_distributions] = distribution_list
    assert_output (<<STR) { AWS::CloudFront.create_or_update }
pegasus distribution created!
dashboard distribution created!
pegasus distribution deployed!
dashboard distribution deployed!
STR
  end

  def test_cloudfront_update
    # Stub list_distributions with the required aliases
    distribution = Aws::CloudFront::Client.new.
      get_distribution(id: 'string').data.distribution.to_h
    distribution_summary = distribution.except(
      :in_progress_invalidation_batches,
      :active_trusted_signers,
      :distribution_config
    ).merge(distribution[:distribution_config].except(
      :caller_reference,
      :default_root_object,
      :logging)
    ).merge(
      aliases: {
        quantity: 2,
        items: [CDO.pegasus_hostname, CDO.dashboard_hostname]
      }
    )
    Aws.config[:cloudfront][:stub_responses][:list_distributions] =
      distribution_list [ distribution_summary ]
    assert_output (<<STR) { AWS::CloudFront.create_or_update }
pegasus distribution updated!
dashboard distribution updated!
pegasus distribution deployed!
dashboard distribution deployed!
STR
  end

end
