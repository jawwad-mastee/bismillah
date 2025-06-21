
<?php
if (!defined('ABSPATH')) exit;
?>

<div id="cod-verifier-token-section" class="cod-verifier-section" style="display:none;">
    <h3><?php _e('Token Payment Verification', 'cod-verifier'); ?></h3>
    <p class="cod-verifier-description">
        <?php _e('Please make a ₹1 token payment to verify your order.', 'cod-verifier'); ?>
    </p>
    
    <div class="cod-verifier-row">
        <div class="cod-verifier-token-payment">
            <button type="button" id="cod_token_pay_btn" class="button cod-verifier-razorpay-btn">
                <?php _e('Pay ₹1 Token via Razorpay', 'cod-verifier'); ?>
            </button>
            <?php if (get_option('cod_verifier_test_mode', '1') === '1'): ?>
            <div class="cod-verifier-test-note">
                <small><?php _e('(Test Mode: Use test card 4111 1111 1111 1111)', 'cod-verifier'); ?></small>
            </div>
            <?php endif; ?>
        </div>
    </div>
    
    <div class="cod-verifier-row">
        <div class="cod-verifier-token-confirmation">
            <label class="cod-verifier-checkbox-label">
                <input type="checkbox" id="cod_token_paid" name="cod_token_paid" value="1">
                <span><?php _e('I confirm that I have paid the ₹1 token payment', 'cod-verifier'); ?></span>
            </label>
            <div class="cod-verifier-message" id="cod-token-message"></div>
        </div>
    </div>
</div>
