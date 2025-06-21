<?php
/*
Plugin Name: COD Verifier for WooCommerce
Description: Multi-country OTP + Token verification for WooCommerce COD orders with Twilio SMS and Razorpay integration
Version: 1.5.0
Author: Your Name
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
WC requires at least: 3.0
WC tested up to: 8.0
Text Domain: cod-verifier
Domain Path: /languages
*/

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('COD_VERIFIER_VERSION', '1.5.0');
define('COD_VERIFIER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('COD_VERIFIER_PLUGIN_PATH', plugin_dir_path(__FILE__));

// Main plugin class
class CODVerifier {
    
    public function __construct() {
        add_action('plugins_loaded', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // Add WooCommerce compatibility declaration
        add_action('before_woocommerce_init', array($this, 'declare_compatibility'));
    }
    
    public function declare_compatibility() {
        if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        }
    }
    
    public function init() {
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return;
        }
        
        // Check PHP version
        if (version_compare(PHP_VERSION, '7.4', '<')) {
            add_action('admin_notices', array($this, 'php_version_notice'));
            return;
        }
        
        // Load text domain
        load_plugin_textdomain('cod-verifier', false, dirname(plugin_basename(__FILE__)) . '/languages');
        
        // Include required files
        $this->include_files();
        
        // Initialize hooks
        $this->init_hooks();
    }
    
    private function include_files() {
        require_once COD_VERIFIER_PLUGIN_PATH . 'includes/settings-page.php';
        require_once COD_VERIFIER_PLUGIN_PATH . 'includes/ajax-handlers.php';
    }
    
    private function init_hooks() {
        // Start session early
        add_action('init', array($this, 'start_session'), 1);
        
        // Enqueue scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Add verification box to footer
        add_action('wp_footer', array($this, 'add_verification_box_to_footer'));
        
        // Server-side validation with HIGHEST PRIORITY
        add_action('woocommerce_checkout_process', array($this, 'validate_checkout'), 1);
        
        // Clean up after order
        add_action('woocommerce_thankyou', array($this, 'cleanup_session'));
        
        // Admin notices for configuration
        add_action('admin_notices', array($this, 'admin_configuration_notices'));
    }
    
    public function start_session() {
        if (!session_id() && !headers_sent()) {
            session_start();
        }
    }
    
    public function enqueue_scripts() {
        if (is_checkout()) {
            wp_enqueue_script('jquery');
            
            // CRITICAL FIX: Enqueue QRCode.js library
            wp_enqueue_script(
                'qrcode-js',
                'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
                array(),
                '1.0.0',
                true
            );
            
            // Main verification script
            wp_enqueue_script(
                'cod-verifier-script',
                COD_VERIFIER_PLUGIN_URL . 'assets/script.js',
                array('jquery', 'qrcode-js'),
                COD_VERIFIER_VERSION,
                true
            );
            
            // Main styles
            wp_enqueue_style(
                'cod-verifier-style',
                COD_VERIFIER_PLUGIN_URL . 'assets/cod-verifier.css',
                array(),
                COD_VERIFIER_VERSION
            );
            
            // Localize script with AJAX data
            wp_localize_script('cod-verifier-script', 'codVerifier', array(
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('cod_verifier_nonce'),
                'enableOTP' => get_option('cod_verifier_enable_otp', '1'),
                'enableToken' => get_option('cod_verifier_enable_token', '1'),
                'testMode' => get_option('cod_verifier_test_mode', '1'),
                'allowedRegions' => get_option('cod_verifier_allowed_regions', 'india'),
                'otpTimerDuration' => get_option('cod_verifier_otp_timer_duration', 30),
            ));
        }
    }
    
    public function add_verification_box_to_footer() {
        if (!is_checkout()) {
            return;
        }
        
        $enable_otp = get_option('cod_verifier_enable_otp', '1');
        $enable_token = get_option('cod_verifier_enable_token', '1');
        
        if ($enable_otp === '1' || $enable_token === '1') {
            // Output hidden template wrapper
            echo '<div id="cod-verification-template" style="display: none;">';
            include COD_VERIFIER_PLUGIN_PATH . 'templates/otp-box.php';
            echo '</div>';
        }
    }
    
    public function validate_checkout() {
        // Get the chosen payment method
        $chosen_payment_method = WC()->session->get('chosen_payment_method');
        
        // Also check POST data for payment method
        if (empty($chosen_payment_method) && isset($_POST['payment_method'])) {
            $chosen_payment_method = sanitize_text_field($_POST['payment_method']);
        }
        
        // Skip validation if not COD
        if ($chosen_payment_method !== 'cod') {
            return;
        }
        
        $enable_otp = get_option('cod_verifier_enable_otp', '1');
        $enable_token = get_option('cod_verifier_enable_token', '1');
        
        $errors = array();
        
        // Start session if not started
        if (!session_id()) {
            session_start();
        }
        
        // Validate OTP
        if ($enable_otp === '1') {
            $otp_verified_session = isset($_SESSION['cod_otp_verified']) ? $_SESSION['cod_otp_verified'] : false;
            $otp_verified_post = isset($_POST['cod_otp_verified']) ? sanitize_text_field($_POST['cod_otp_verified']) : '0';
            
            if (!$otp_verified_session && $otp_verified_post !== '1') {
                $errors[] = __('Please verify your phone number with OTP before placing the order.', 'cod-verifier');
            }
        }
        
        // Validate Token
        if ($enable_token === '1') {
            $token_paid_session = isset($_SESSION['cod_token_paid']) ? $_SESSION['cod_token_paid'] : false;
            $token_verified_post = isset($_POST['cod_token_verified']) ? sanitize_text_field($_POST['cod_token_verified']) : '0';
            
            if (!$token_paid_session && $token_verified_post !== '1') {
                $errors[] = __('Please complete the ₹1 token payment before placing the order.', 'cod-verifier');
            }
        }
        
        // If there are errors, prevent order processing
        if (!empty($errors)) {
            foreach ($errors as $error) {
                wc_add_notice($error, 'error');
            }
            
            // Stop processing immediately for AJAX requests
            if (wp_doing_ajax()) {
                wp_send_json_error(array(
                    'messages' => implode('<br>', $errors),
                    'refresh' => false,
                    'reload' => false
                ));
            }
            
            // For non-AJAX, throw exception to stop checkout
            throw new Exception(implode(' ', $errors));
        }
    }
    
    public function cleanup_session($order_id) {
        // Clean up session variables
        if (isset($_SESSION['cod_otp'])) unset($_SESSION['cod_otp']);
        if (isset($_SESSION['cod_otp_phone'])) unset($_SESSION['cod_otp_phone']);
        if (isset($_SESSION['cod_otp_time'])) unset($_SESSION['cod_otp_time']);
        if (isset($_SESSION['cod_otp_verified'])) unset($_SESSION['cod_otp_verified']);
        if (isset($_SESSION['cod_token_paid'])) unset($_SESSION['cod_token_paid']);
        if (isset($_SESSION['cod_payment_link_id'])) unset($_SESSION['cod_payment_link_id']);
        if (isset($_SESSION['cod_payment_link_created'])) unset($_SESSION['cod_payment_link_created']);
    }
    
    public function admin_configuration_notices() {
        // Only show on plugin settings page or WooCommerce pages
        $screen = get_current_screen();
        if (!$screen || (strpos($screen->id, 'woocommerce') === false && strpos($screen->id, 'cod-verifier') === false)) {
            return;
        }
        
        $enable_otp = get_option('cod_verifier_enable_otp', '1');
        $enable_token = get_option('cod_verifier_enable_token', '1');
        $test_mode = get_option('cod_verifier_test_mode', '1');
        $allowed_regions = get_option('cod_verifier_allowed_regions', 'india');
        
        // Check Twilio configuration in production mode
        if ($enable_otp === '1' && $test_mode === '0') {
            $twilio_sid = get_option('cod_verifier_twilio_sid', '');
            $twilio_token = get_option('cod_verifier_twilio_token', '');
            $twilio_number = get_option('cod_verifier_twilio_number', '');
            
            if (empty($twilio_sid) || empty($twilio_token) || empty($twilio_number)) {
                echo '<div class="notice notice-warning"><p>';
                echo __('COD Verifier: Twilio SMS configuration is incomplete. Please configure your Twilio settings in ', 'cod-verifier');
                echo '<a href="' . admin_url('admin.php?page=cod-verifier-settings') . '">plugin settings</a>.';
                echo '</p></div>';
            }
        }
        
        // Check Razorpay configuration in production mode
        if ($enable_token === '1' && $test_mode === '0') {
            $razorpay_key_id = get_option('cod_verifier_razorpay_key_id', '');
            $razorpay_key_secret = get_option('cod_verifier_razorpay_key_secret', '');
            
            if (empty($razorpay_key_id) || empty($razorpay_key_secret)) {
                echo '<div class="notice notice-warning"><p>';
                echo __('COD Verifier: Razorpay configuration is incomplete. Please configure your Razorpay settings in ', 'cod-verifier');
                echo '<a href="' . admin_url('admin.php?page=cod-verifier-settings') . '">plugin settings</a>.';
                echo '</p></div>';
            }
        }
        
        // Check if Twilio SDK exists
        $twilio_autoload = COD_VERIFIER_PLUGIN_PATH . 'includes/twilio-sdk/src/Twilio/autoload.php';
        if ($enable_otp === '1' && !file_exists($twilio_autoload)) {
            echo '<div class="notice notice-error"><p>';
            echo __('COD Verifier: Twilio SDK not found. Please ensure the Twilio SDK is properly installed in the includes/twilio-sdk/ directory.', 'cod-verifier');
            echo '</p></div>';
        }
        
        // Multi-country configuration notice
        if ($allowed_regions === 'global') {
            echo '<div class="notice notice-info"><p>';
            echo __('COD Verifier: Multi-country mode is enabled. Ensure your Twilio number supports SMS to India (+91), USA (+1), and UK (+44).', 'cod-verifier');
            echo '</p></div>';
        }
    }
    
    public function woocommerce_missing_notice() {
        echo '<div class="notice notice-error"><p>';
        echo __('COD Verifier requires WooCommerce to be installed and active.', 'cod-verifier');
        echo '</p></div>';
    }
    
    public function php_version_notice() {
        echo '<div class="notice notice-error"><p>';
        echo sprintf(__('COD Verifier requires PHP 7.4 or higher. You are running PHP %s.', 'cod-verifier'), PHP_VERSION);
        echo '</p></div>';
    }
    
    public function activate() {
        // Set default options
        add_option('cod_verifier_enable_otp', '1');
        add_option('cod_verifier_enable_token', '1');
        add_option('cod_verifier_test_mode', '1');
        add_option('cod_verifier_allowed_regions', 'india'); // Default to India for backward compatibility
        add_option('cod_verifier_otp_timer_duration', 30); // Default 30 seconds
        add_option('cod_verifier_twilio_sid', '');
        add_option('cod_verifier_twilio_token', '');
        add_option('cod_verifier_twilio_number', '');
        add_option('cod_verifier_razorpay_key_id', '');
        add_option('cod_verifier_razorpay_key_secret', '');
        add_option('cod_verifier_razorpay_webhook_secret', '');
        
        // Check if Twilio SDK directory exists
        $twilio_sdk_path = COD_VERIFIER_PLUGIN_PATH . 'includes/twilio-sdk/';
        if (!is_dir($twilio_sdk_path)) {
            wp_mkdir_p($twilio_sdk_path);
        }
    }
    
    public function deactivate() {
        // Clean up if needed
    }
}

// Initialize the plugin
new CODVerifier();
?>