<?php
if (!defined('ABSPATH')) {
    exit;
}

class CODVerifierAjax {
    
    public function __construct() {
        // Existing OTP handlers - DO NOT MODIFY
        add_action('wp_ajax_cod_send_otp', array($this, 'send_otp'));
        add_action('wp_ajax_nopriv_cod_send_otp', array($this, 'send_otp'));
        add_action('wp_ajax_cod_verify_otp', array($this, 'verify_otp'));
        add_action('wp_ajax_nopriv_cod_verify_otp', array($this, 'verify_otp'));
        
        // Razorpay Token Payment Handlers - MODIFIED for Standard Checkout
        add_action('wp_ajax_cod_create_payment_link', array($this, 'create_payment_link'));
        add_action('wp_ajax_nopriv_cod_create_payment_link', array($this, 'create_payment_link'));
        
        // NEW: Server-side verification handler for frontend Checkout JS callback
        add_action('wp_ajax_cod_verify_token_payment_server', array($this, 'verify_token_payment_server'));
        add_action('wp_ajax_nopriv_cod_verify_token_payment_server', array($this, 'verify_token_payment_server'));
        
        // NEW: Payment status checker for polling
        add_action('wp_ajax_cod_check_payment_status', array($this, 'check_payment_status'));
        add_action('wp_ajax_nopriv_cod_check_payment_status', array($this, 'check_payment_status'));
        
        // Enhanced webhook handler for payment.captured
        add_action('wp_ajax_cod_razorpay_webhook', array($this, 'handle_webhook'));
        add_action('wp_ajax_nopriv_cod_razorpay_webhook', array($this, 'handle_webhook'));
    }
    
    public function send_otp() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'cod_verifier_nonce')) {
            wp_send_json_error(__('Security check failed.', 'cod-verifier'));
            return;
        }
        
        // Get phone data - support both old and new format
        $phone = sanitize_text_field($_POST['phone']); // Full E.164 format
        $country_code = isset($_POST['country_code']) ? sanitize_text_field($_POST['country_code']) : '';
        $phone_number = isset($_POST['phone_number']) ? sanitize_text_field($_POST['phone_number']) : '';
        
        // Validate allowed regions
        $allowed_regions = get_option('cod_verifier_allowed_regions', 'india');
        $region_validation = $this->validate_phone_region($phone, $allowed_regions);
        
        if (!$region_validation['valid']) {
            wp_send_json_error($region_validation['message']);
            return;
        }
        
        // Enhanced phone validation
        $phone_validation = $this->validate_phone_number($phone, $country_code, $phone_number);
        if (!$phone_validation['valid']) {
            wp_send_json_error($phone_validation['message']);
            return;
        }
        
        $test_mode = get_option('cod_verifier_test_mode', '1');
        
        if (!session_id()) {
            session_start();
        }
        
        // Check cooldown period (prevent spam)
        $cooldown_duration = get_option('cod_verifier_otp_timer_duration', 30);
        if (isset($_SESSION['cod_otp_time']) && (time() - $_SESSION['cod_otp_time'] < $cooldown_duration)) {
            $remaining = $cooldown_duration - (time() - $_SESSION['cod_otp_time']);
            wp_send_json_error(sprintf(__('Please wait %d seconds before resending OTP.', 'cod-verifier'), $remaining));
            return;
        }

        // Generate OTP
        $otp = sprintf('%06d', rand(100000, 999999));
        $_SESSION['cod_otp'] = $otp;
        $_SESSION['cod_otp_phone'] = $phone;
        $_SESSION['cod_otp_time'] = time();
        $_SESSION['cod_otp_verified'] = false;
        
        if ($test_mode === '1') {
            // Test mode - return OTP in response
            wp_send_json_success(array(
                'message' => __('OTP sent successfully! (Test Mode)', 'cod-verifier'),
                'otp' => $otp,
                'test_mode' => true
            ));
        } else {
            // Production mode - send actual SMS via Twilio
            $result = $this->send_twilio_sms($phone, $otp);
            
            if ($result['success']) {
                wp_send_json_success(array(
                    'message' => __('OTP sent successfully to your mobile number!', 'cod-verifier')
                ));
            } else {
                wp_send_json_error($result['message']);
            }
        }
    }
    
    private function validate_phone_region($phone, $allowed_regions) {
        // Extract country code from phone number
        $country_code = '';
        if (strpos($phone, '+91') === 0) {
            $country_code = '+91';
        } elseif (strpos($phone, '+1') === 0) {
            $country_code = '+1';
        } elseif (strpos($phone, '+44') === 0) {
            $country_code = '+44';
        } else {
            return array(
                'valid' => false,
                'message' => __('Invalid phone number format. Please include country code.', 'cod-verifier')
            );
        }
        
        // Check against allowed regions
        switch ($allowed_regions) {
            case 'india':
                if ($country_code !== '+91') {
                    return array(
                        'valid' => false,
                        'message' => __('Only Indian phone numbers (+91) are allowed.', 'cod-verifier')
                    );
                }
                break;
                
            case 'usa':
                if ($country_code !== '+1') {
                    return array(
                        'valid' => false,
                        'message' => __('Only US phone numbers (+1) are allowed.', 'cod-verifier')
                    );
                }
                break;
                
            case 'uk':
                if ($country_code !== '+44') {
                    return array(
                        'valid' => false,
                        'message' => __('Only UK phone numbers (+44) are allowed.', 'cod-verifier')
                    );
                }
                break;
                
            case 'global':
                // All supported countries are allowed
                if (!in_array($country_code, ['+91', '+1', '+44'])) {
                    return array(
                        'valid' => false,
                        'message' => __('Unsupported country code. Supported: +91 (India), +1 (USA), +44 (UK).', 'cod-verifier')
                    );
                }
                break;
                
            default:
                return array(
                    'valid' => false,
                    'message' => __('Invalid region configuration.', 'cod-verifier')
                );
        }
        
        return array('valid' => true, 'message' => 'Valid region');
    }
    
    private function validate_phone_number($phone, $country_code = '', $phone_number = '') {
        // Validation rules for each country
        $validation_rules = array(
            '+91' => array(
                'pattern' => '/^\+91[6-9]\d{9}$/',
                'name' => 'Indian',
                'example' => '+917039940998'
            ),
            '+1' => array(
                'pattern' => '/^\+1[2-9]\d{9}$/',
                'name' => 'US',
                'example' => '+12125551234'
            ),
            '+44' => array(
                'pattern' => '/^\+447\d{9}$/',
                'name' => 'UK',
                'example' => '+447700900123'
            )
        );
        
        // Determine country code from phone number
        $detected_country = '';
        foreach ($validation_rules as $code => $rule) {
            if (strpos($phone, $code) === 0) {
                $detected_country = $code;
                break;
            }
        }
        
        if (empty($detected_country)) {
            return array(
                'valid' => false,
                'message' => __('Invalid phone number format. Supported formats: +91 (India), +1 (USA), +44 (UK).', 'cod-verifier')
            );
        }
        
        $rule = $validation_rules[$detected_country];
        
        if (!preg_match($rule['pattern'], $phone)) {
            return array(
                'valid' => false,
                'message' => sprintf(
                    __('Please enter a valid %s phone number (e.g., %s).', 'cod-verifier'),
                    $rule['name'],
                    $rule['example']
                )
            );
        }
        
        return array('valid' => true, 'message' => 'Valid phone number');
    }
    
    private function send_twilio_sms($phone, $otp) {
        try {
            // Get Twilio settings
            $sid = get_option('cod_verifier_twilio_sid', '');
            $token = get_option('cod_verifier_twilio_token', '');
            $twilio_number = get_option('cod_verifier_twilio_number', '');
            
            if (empty($sid) || empty($token) || empty($twilio_number)) {
                return array(
                    'success' => false,
                    'message' => __('Twilio SMS service not configured. Please contact administrator.', 'cod-verifier')
                );
            }
            
            // Load Twilio SDK
            $twilio_autoload = COD_VERIFIER_PLUGIN_PATH . 'includes/twilio-sdk/src/Twilio/autoload.php';
            
            if (!file_exists($twilio_autoload)) {
                error_log('COD Verifier: Twilio SDK not found at ' . $twilio_autoload);
                return array(
                    'success' => false,
                    'message' => __('SMS service temporarily unavailable. Please try again later.', 'cod-verifier')
                );
            }
            
            require_once $twilio_autoload;
            
            // Phone number is already in E.164 format from frontend validation
            $formatted_phone = $phone;
            
            // Final validation for E.164 format
            if (!preg_match('/^\+\d{10,15}$/', $formatted_phone)) {
                return array(
                    'success' => false,
                    'message' => __('Invalid phone number format for SMS delivery.', 'cod-verifier')
                );
            }

            // Create Twilio client
            $client = new \Twilio\Rest\Client($sid, $token);
            
            // Customize message based on country
            $country_name = 'your';
            if (strpos($phone, '+91') === 0) {
                $country_name = 'Indian';
            } elseif (strpos($phone, '+1') === 0) {
                $country_name = 'US';
            } elseif (strpos($phone, '+44') === 0) {
                $country_name = 'UK';
            }
            
            $message = "Your COD verification OTP is: {$otp}. Valid for 5 minutes. Do not share this code. - COD Verifier";
            
            // Send SMS
            $result = $client->messages->create(
                $formatted_phone,
                array(
                    'from' => $twilio_number,
                    'body' => $message
                )
            );
            
            if ($result->sid) {
                error_log('COD Verifier: SMS sent successfully to ' . $formatted_phone . '. SID: ' . $result->sid);
                return array(
                    'success' => true,
                    'message' => sprintf(__('OTP sent successfully to your %s number!', 'cod-verifier'), $country_name)
                );
            } else {
                error_log('COD Verifier: SMS sending failed - no SID returned');
                return array(
                    'success' => false,
                    'message' => __('Failed to send OTP. Please try again.', 'cod-verifier')
                );
            }
            
        } catch (\Twilio\Exceptions\RestException $e) {
            error_log('COD Verifier: Twilio REST Exception: ' . $e->getMessage());
            
            // Provide user-friendly error messages
            $error_code = $e->getCode();
            switch ($error_code) {
                case 21211:
                    $user_message = __('Invalid phone number. Please check and try again.', 'cod-verifier');
                    break;
                case 21408:
                    $user_message = __('SMS not supported for this number. Please try a different number.', 'cod-verifier');
                    break;
                case 21614:
                    $user_message = __('Invalid sender number configuration. Please contact support.', 'cod-verifier');
                    break;
                default:
                    $user_message = __('SMS service error. Please check your phone number and try again.', 'cod-verifier');
            }
            
            return array(
                'success' => false,
                'message' => $user_message
            );
        } catch (Exception $e) {
            error_log('COD Verifier: General Exception: ' . $e->getMessage());
            return array(
                'success' => false,
                'message' => __('Failed to send OTP. Please try again later.', 'cod-verifier')
            );
        }
    }
    
    public function verify_otp() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'cod_verifier_nonce')) {
            wp_send_json_error(__('Security check failed.', 'cod-verifier'));
            return;
        }
        
        $otp = sanitize_text_field($_POST['otp']);
        
        if (!session_id()) {
            session_start();
        }
        
        $stored_otp = isset($_SESSION['cod_otp']) ? $_SESSION['cod_otp'] : '';
        $otp_time = isset($_SESSION['cod_otp_time']) ? $_SESSION['cod_otp_time'] : 0;
        
        if (empty($stored_otp)) {
            wp_send_json_error(__('No OTP found. Please request a new OTP.', 'cod-verifier'));
            return;
        }
        
        // Check if OTP is expired (5 minutes)
        if (time() - $otp_time > 300) {
            unset($_SESSION['cod_otp']);
            wp_send_json_error(__('OTP expired. Please request a new OTP.', 'cod-verifier'));
            return;
        }
        
        if ($otp === $stored_otp) {
            $_SESSION['cod_otp_verified'] = true;
            wp_send_json_success(__('OTP verified successfully!', 'cod-verifier'));
        } else {
            wp_send_json_error(__('Invalid OTP. Please try again.', 'cod-verifier'));
        }
    }
    
    // MODIFIED: Create Razorpay Order instead of Payment Link
    public function create_payment_link() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'cod_verifier_nonce')) {
            wp_send_json_error(__('Security check failed.', 'cod-verifier'));
            return;
        }
        
        $test_mode = get_option('cod_verifier_test_mode', '1');
        
        if (!session_id()) {
            session_start();
        }
        
        // Get WooCommerce Order ID from session (set during checkout process)
        $woocommerce_order_id = WC()->session->get('cod_verifier_temp_order_id');
        if (!$woocommerce_order_id) {
            // Try to get from current cart/checkout context
            $woocommerce_order_id = 'temp_' . time();
            WC()->session->set('cod_verifier_temp_order_id', $woocommerce_order_id);
        }
        
        if ($test_mode === '1') {
            // Test mode - simulate Razorpay Order creation
            $customer_phone = isset($_SESSION['cod_otp_phone']) ? $_SESSION['cod_otp_phone'] : '';
            $customer_email = is_user_logged_in() ? wp_get_current_user()->user_email : '';
            $customer_name = '';
            
            if (is_user_logged_in()) {
                $user = wp_get_current_user();
                $customer_name = $user->display_name;
            }
            
            wp_send_json_success(array(
                'order_id' => 'order_test_' . time(),
                'amount' => 100,
                'currency' => 'INR',
                'key_id' => 'rzp_test_key',
                'customer_name' => $customer_name,
                'customer_email' => $customer_email,
                'customer_phone' => $customer_phone,
                'test_mode' => true,
                'message' => __('Test mode: Razorpay Order created successfully', 'cod-verifier')
            ));
            return;
        }
        
        // Production mode
        $key_id = get_option('cod_verifier_razorpay_key_id', '');
        $key_secret = get_option('cod_verifier_razorpay_key_secret', '');
        
        if (empty($key_id) || empty($key_secret)) {
            wp_send_json_error(__('Razorpay not configured. Please add API keys in settings.', 'cod-verifier'));
            return;
        }
        
        // Get customer details
        $customer_phone = isset($_SESSION['cod_otp_phone']) ? $_SESSION['cod_otp_phone'] : '';
        $customer_email = '';
        $customer_name = '';
        
        if (is_user_logged_in()) {
            $user = wp_get_current_user();
            $customer_email = $user->user_email;
            $customer_name = $user->display_name;
        }
        
        // Generate unique reference_id
        $reference_id = substr(md5(uniqid('', true)), 0, 30);
        
        // Prepare data for creating a Razorpay Order
        $order_data = array(
            'amount' => 100, // ₹1 in paise
            'currency' => 'INR',
            'receipt' => 'woo_order_' . $woocommerce_order_id,
            'notes' => array(
                'purpose' => 'COD Token Payment',
                'auto_refund' => 'yes',
                'site_url' => home_url(),
                'woo_order_id' => $woocommerce_order_id
            )
        );
        
        // Add customer details to notes if available
        if (!empty($customer_name)) $order_data['notes']['customer_name'] = $customer_name;
        if (!empty($customer_email)) $order_data['notes']['customer_email'] = $customer_email;
        if (!empty($customer_phone)) $order_data['notes']['customer_phone'] = $customer_phone;
        
        // Make API call to create Razorpay Order
        $response = wp_remote_post('https://api.razorpay.com/v1/orders', array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($key_id . ':' . $key_secret),
                'Content-Type' => 'application/json'
            ),
            'body' => json_encode($order_data),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('COD Verifier Razorpay Order Creation WP Error: ' . $response->get_error_message());
            wp_send_json_error(__('Failed to create payment order due to a technical error.', 'cod-verifier'));
            return;
        }
        
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);
        
        if (isset($result['id'])) {
            // Success: Return the Razorpay Order details
            wp_send_json_success(array(
                'order_id' => $result['id'],
                'amount' => $result['amount'],
                'currency' => $result['currency'],
                'key_id' => $key_id,
                'customer_name' => $customer_name,
                'customer_email' => $customer_email,
                'customer_phone' => $customer_phone,
                'test_mode' => false,
                'message' => __('Razorpay Order created successfully', 'cod-verifier')
            ));
        } else {
            $error_message = isset($result['error']['description']) ? $result['error']['description'] : __('Failed to create payment order. Please check plugin settings and logs.', 'cod-verifier');
            error_log('COD Verifier Razorpay Order Creation API Error: ' . ($body ?? 'Unknown Error'));
            wp_send_json_error($error_message);
        }
    }
    
    // NEW: Check payment status for polling
    public function check_payment_status() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'cod_verifier_nonce')) {
            wp_send_json_error(__('Security check failed.', 'cod-verifier'));
            return;
        }
        
        $payment_id = sanitize_text_field($_POST['payment_id'] ?? '');
        
        if (empty($payment_id)) {
            wp_send_json_error(__('Payment ID is required.', 'cod-verifier'));
            return;
        }
        
        $test_mode = get_option('cod_verifier_test_mode', '1');
        
        if ($test_mode === '1') {
            // Test mode - simulate captured status
            wp_send_json_success(array(
                'status' => 'captured',
                'message' => __('Payment status checked successfully (Test Mode)', 'cod-verifier')
            ));
            return;
        }
        
        // Production mode - check actual payment status
        $key_id = get_option('cod_verifier_razorpay_key_id', '');
        $key_secret = get_option('cod_verifier_razorpay_key_secret', '');
        
        if (empty($key_id) || empty($key_secret)) {
            wp_send_json_error(__('Razorpay not configured.', 'cod-verifier'));
            return;
        }
        
        // Make API call to check payment status
        $response = wp_remote_get("https://api.razorpay.com/v1/payments/{$payment_id}", array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($key_id . ':' . $key_secret),
            ),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('COD Verifier Payment Status Check WP Error: ' . $response->get_error_message());
            wp_send_json_error(__('Failed to check payment status.', 'cod-verifier'));
            return;
        }
        
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);
        
        if (isset($result['status'])) {
            wp_send_json_success(array(
                'status' => $result['status'],
                'message' => __('Payment status checked successfully', 'cod-verifier')
            ));
        } else {
            wp_send_json_error(__('Failed to get payment status.', 'cod-verifier'));
        }
    }
    
    // NEW: Server-side verification for frontend Checkout JS callback
    public function verify_token_payment_server() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'cod_verifier_nonce')) {
            wp_send_json_error(__('Security check failed.', 'cod-verifier'));
            return;
        }
        
        // Sanitize input
        $payment_id = sanitize_text_field($_POST['payment_id'] ?? '');
        $order_id = sanitize_text_field($_POST['order_id'] ?? '');
        $razorpay_signature = sanitize_text_field($_POST['signature'] ?? '');
        
        if (empty($payment_id) || empty($order_id) || empty($razorpay_signature)) {
            wp_send_json_error(__('Payment verification failed. Missing required parameters.', 'cod-verifier'));
            return;
        }
        
        $test_mode = get_option('cod_verifier_test_mode', '1');
        
        if ($test_mode === '1') {
            // Test mode - simulate verification
            if (!session_id()) {
                session_start();
            }
            $_SESSION['cod_token_paid'] = true;
            wp_send_json_success(__('Payment verified successfully! (Test Mode - No actual charge)', 'cod-verifier'));
            return;
        }
        
        // Production mode - verify signature
        $key_secret = get_option('cod_verifier_razorpay_key_secret', '');
        
        if (empty($key_secret)) {
            error_log('COD Verifier Server Verification Error: Razorpay Key Secret not configured.');
            wp_send_json_error(__('Razorpay configuration error. Please contact site administrator.', 'cod-verifier'));
            return;
        }
        
        // Generate expected signature
        $generated_signature = hash_hmac('sha256', $order_id . '|' . $payment_id, $key_secret);
        
        if (hash_equals($generated_signature, $razorpay_signature)) {
            // Signature is valid
            if (!session_id()) {
                session_start();
            }
            $_SESSION['cod_token_paid'] = true;
            
            // Initiate auto-refund
            $refund_result = $this->initiate_auto_refund($payment_id);
            
            if ($refund_result['success']) {
                wp_send_json_success(__('Payment verified successfully! ₹1 refund initiated automatically.', 'cod-verifier'));
            } else {
                wp_send_json_success(__('Payment verified successfully! Refund will be processed within 24 hours.', 'cod-verifier'));
            }
        } else {
            error_log('COD Verifier Server Verification Error: Signature mismatch for Payment ID: ' . $payment_id);
            wp_send_json_error(__('Payment verification failed. Invalid signature.', 'cod-verifier'));
        }
    }
    
    // ENHANCED: Webhook handler for payment.captured
    public function handle_webhook() {
        $payload = @file_get_contents('php://input');
        $sig_header = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
        
        // Get webhook secret from settings
        $webhook_secret = get_option('cod_verifier_razorpay_webhook_secret', '');
        
        // Verify webhook signature
        if (!empty($webhook_secret)) {
            $expected_signature = hash_hmac('sha256', $payload, $webhook_secret);
            if (!hash_equals($expected_signature, $sig_header)) {
                error_log('COD Verifier Webhook Error: Invalid signature.');
                header('Status: 400 Bad Request', true, 400);
                exit;
            }
        } else {
            if (get_option('cod_verifier_test_mode', '1') === '0') {
                error_log('COD Verifier Webhook Warning: Webhook secret not configured. Signature not verified.');
            }
        }
        
        $data = json_decode($payload, true);
        
        // Process payment.captured event
        if (isset($data['event']) && $data['event'] === 'payment.captured') {
            $payment_entity = $data['payload']['payment']['entity'];
            $payment_id = $payment_entity['id'];
            $razorpay_order_id = $payment_entity['order_id'];
            
            // Find WooCommerce Order ID
            $woo_order_id = null;
            if (isset($payment_entity['notes']['woo_order_id'])) {
                $woo_order_id = $payment_entity['notes']['woo_order_id'];
            } elseif (isset($payment_entity['receipt']) && strpos($payment_entity['receipt'], 'woo_order_') === 0) {
                $woo_order_id = str_replace('woo_order_', '', $payment_entity['receipt']);
            }
            
            if ($woo_order_id) {
                $order = wc_get_order($woo_order_id);
                
                if ($order && $order->get_payment_method() === 'cod') {
                    if ($order->get_status() !== 'processing' && $order->get_status() !== 'completed') {
                        // Update order status
                        $order->update_status('processing', sprintf(__('Razorpay token payment (%s) captured. Order status updated via webhook.', 'cod-verifier'), $payment_id));
                        
                        // Initiate auto-refund
                        $refund_result = $this->initiate_auto_refund($payment_id);
                        
                        error_log('COD Verifier Webhook: Payment ' . $payment_id . ' captured for Order ' . $woo_order_id . '. Status updated. Refund: ' . ($refund_result['success'] ? 'Success' : 'Failed'));
                        
                        // Store payment ID as order meta
                        $order->add_meta_data('_razorpay_token_payment_id', $payment_id, true);
                        $order->save();
                    } else {
                        error_log('COD Verifier Webhook Info: Received payment.captured for Order ' . $woo_order_id . ' but status is already ' . $order->get_status());
                    }
                } else {
                    error_log('COD Verifier Webhook Error: WooCommerce Order with ID ' . $woo_order_id . ' not found or is not a COD order.');
                }
            } else {
                error_log('COD Verifier Webhook Error: WooCommerce Order ID not found in webhook payload for payment ' . $payment_id);
            }
        } else {
            error_log('COD Verifier Webhook Info: Received event "' . ($data['event'] ?? 'unknown') . '", not processing for order status update.');
        }
        
        // Acknowledge webhook
        header('Status: 200 OK', true, 200);
        exit;
    }
    
    private function initiate_auto_refund($payment_id) {
        $key_id = get_option('cod_verifier_razorpay_key_id', '');
        $key_secret = get_option('cod_verifier_razorpay_key_secret', '');
        
        if (empty($key_id) || empty($key_secret)) {
            return array('success' => false, 'message' => 'Razorpay keys not configured');
        }
        
        $refund_data = array(
            'amount' => 100, // Full ₹1 refund
            'speed' => 'normal',
            'notes' => array(
                'reason' => 'COD Token Verification Complete',
                'auto_refund' => 'yes'
            )
        );
        
        $response = wp_remote_post("https://api.razorpay.com/v1/payments/{$payment_id}/refund", array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($key_id . ':' . $key_secret),
                'Content-Type' => 'application/json'
            ),
            'body' => json_encode($refund_data),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('COD Verifier: Refund failed - ' . $response->get_error_message());
            return array('success' => false, 'message' => $response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);
        
        if (isset($result['id'])) {
            error_log('COD Verifier: Refund successful - ID: ' . $result['id']);
            return array('success' => true, 'refund_id' => $result['id']);
        } else {
            error_log('COD Verifier: Refund failed - ' . $body);
            return array('success' => false, 'message' => 'Refund API error');
        }
    }
}

new CODVerifierAjax();
?>