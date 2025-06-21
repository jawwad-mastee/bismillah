
=== COD Verifier for WooCommerce ===
Contributors: jawwad
Tags: woocommerce, cod, cash on delivery, otp, verification
Requires at least: 5.0
Tested up to: 6.2
Stable tag: 1.0
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Add OTP and Token payment verification for Cash on Delivery orders in WooCommerce.

== Description ==

COD Verifier for WooCommerce adds extra verification steps for Cash on Delivery orders:

* OTP Verification: Customers must verify their phone number with a 6-digit OTP
* Token Payment: Customers must make a ₹1 token payment to confirm their order
* Flexible Options: Enable OTP only, Token only, both, or disable verification

This plugin helps reduce fake orders and increases order fulfillment rates.

**Note:** This is a test mode version. For production use with real SMS API and payment gateway integration, please look for the Pro version.

== Installation ==

1. Upload the plugin folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to WooCommerce > COD Verifier to configure settings

== Frequently Asked Questions ==

= Does this plugin require a SMS API account? =
No, this test version simulates OTP by showing it in an alert message.

= Does this plugin require a Razorpay account? =
No, this test version simulates token payment with a checkbox.

= Is this plugin suitable for production use? =
This version is for testing and development only. For production use, look for the Pro version with real API integration.

== Screenshots ==

1. Admin settings panel
2. OTP verification at checkout
3. Token payment verification at checkout

== Changelog ==

= 1.0 =
* Initial release

== Upgrade Notice ==

= 1.0 =
Initial release
