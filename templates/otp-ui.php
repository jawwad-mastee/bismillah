
<?php
if (!defined('ABSPATH')) exit;
?>

<div id="cod-verifier-otp-section" class="cod-verifier-section" style="display:none;">
    <h3><?php _e('OTP Verification', 'cod-verifier'); ?></h3>
    <p class="cod-verifier-description">
        <?php _e('Verify your phone number with OTP to place COD order.', 'cod-verifier'); ?>
    </p>
    
    <div class="cod-verifier-row">
        <div class="cod-verifier-phone-wrap">
            <label for="cod_verifier_phone"><?php _e('Phone Number', 'cod-verifier'); ?></label>
            <input type="tel" id="cod_verifier_phone" name="cod_verifier_phone" 
                   placeholder="<?php _e('Enter your 10-digit mobile number', 'cod-verifier'); ?>" 
                   maxlength="10" pattern="[6-9][0-9]{9}">
        </div>
        <div class="cod-verifier-otp-btn-wrap">
            <button type="button" id="cod_send_otp_btn" class="button">
                <?php _e('Send OTP', 'cod-verifier'); ?>
            </button>
            <div id="cod_otp_timer" class="cod-verifier-timer" style="display:none;">
                <?php _e('Resend in:', 'cod-verifier'); ?> <span id="cod_otp_countdown">15</span>s
            </div>
        </div>
    </div>
    
    <div class="cod-verifier-row">
        <div class="cod-verifier-otp-wrap">
            <label for="cod_verifier_otp"><?php _e('Enter OTP', 'cod-verifier'); ?></label>
            <div class="cod-verifier-otp-input-group">
                <input type="text" id="cod_verifier_otp" name="cod_verifier_otp" 
                       placeholder="<?php _e('6-digit OTP', 'cod-verifier'); ?>" 
                       maxlength="6" pattern="[0-9]{6}">
                <button type="button" id="cod_verify_otp_btn" class="button" disabled>
                    <?php _e('Verify', 'cod-verifier'); ?>
                </button>
            </div>
            <div class="cod-verifier-message" id="cod-otp-message"></div>
        </div>
    </div>
</div>
