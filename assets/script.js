jQuery(document).ready(function($) {
    'use strict';
    
    console.log('COD Verifier: Multi-country script with Razorpay Payment Links initialized');
    
    // Check if codVerifier is defined
    if (typeof codVerifier === 'undefined') {
        console.error('COD Verifier: codVerifier object not found.');
        return;
    }
    
    // Get settings from global variable
    const settings = window.codVerifierSettings || {
        allowedRegions: 'india',
        otpTimerDuration: 30,
        testMode: '1'
    };
    
    // Global verification state
    window.codVerifierStatus = {
      otpVerified: false,
      tokenVerified: false
    };
    
    let isBlockCheckout = $('.wc-block-checkout').length > 0;
    let verificationBoxCreated = false;
    let warningMessageCreated = false;
    let otpTimer = null;
    let tokenTimer = null;
    let paymentModal = null;
    
    console.log('COD Verifier: Checkout type:', isBlockCheckout ? 'Blocks' : 'Classic');
    console.log('COD Verifier: Settings:', settings);
    
    // ===== MULTI-COUNTRY PHONE VALIDATION =====
    
    const phoneValidationRules = {
        '+91': {
            name: 'India',
            pattern: /^[6-9]\d{9}$/,
            placeholder: 'Enter 10-digit number (e.g., 7039940998)',
            length: 10
        },
        '+1': {
            name: 'USA',
            pattern: /^[2-9]\d{9}$/,
            placeholder: 'Enter 10-digit number (e.g., 2125551234)',
            length: 10
        },
        '+44': {
            name: 'UK',
            pattern: /^7\d{9}$/,
            placeholder: 'Enter 10-digit number (e.g., 7700900123)',
            length: 10
        }
    };
    
    function validatePhoneNumber(countryCode, phoneNumber) {
        const rule = phoneValidationRules[countryCode];
        if (!rule) {
            return { valid: false, message: 'Unsupported country code' };
        }
        
        if (!phoneNumber || phoneNumber.length !== rule.length) {
            return { valid: false, message: `Please enter a ${rule.length}-digit ${rule.name} phone number` };
        }
        
        if (!rule.pattern.test(phoneNumber)) {
            return { valid: false, message: `Please enter a valid ${rule.name} phone number` };
        }
        
        return { valid: true, message: 'Valid phone number' };
    }
    
    function updatePhoneHelperText() {
        const countryCode = $('#cod_country_code').val();
        const rule = phoneValidationRules[countryCode];
        if (rule) {
            $('#cod_phone_help_text').text(rule.placeholder);
            $('#cod_phone').attr('placeholder', rule.placeholder.split('(e.g., ')[0].trim());
        }
    }
    
    // ===== OTP TIMER FUNCTIONALITY =====
    
    function startOTPTimer(duration) {
        const $btn = $('#cod_send_otp');
        let timeLeft = duration;
        
        // Disable button and change appearance
        $btn.prop('disabled', true)
            .addClass('cod-btn-timer-active')
            .removeClass('cod-btn-primary');
        
        // Update button text immediately
        updateTimerDisplay(timeLeft, $btn);
        
        // Start countdown
        otpTimer = setInterval(() => {
            timeLeft--;
            updateTimerDisplay(timeLeft, $btn);
            
            if (timeLeft <= 0) {
                clearInterval(otpTimer);
                otpTimer = null;
                
                // Re-enable button and restore appearance
                $btn.prop('disabled', false)
                    .removeClass('cod-btn-timer-active')
                    .addClass('cod-btn-primary')
                    .text('Send OTP');
                
                console.log('COD Verifier: OTP timer completed');
            }
        }, 1000);
        
        console.log('COD Verifier: OTP timer started for', duration, 'seconds');
    }
    
    function updateTimerDisplay(timeLeft, $btn) {
        if (timeLeft > 0) {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const displayTime = seconds < 10 ? `0${seconds}` : seconds;
            
            if (minutes > 0) {
                $btn.text(`Resend in ${minutes}:${displayTime}`);
            } else {
                $btn.text(`Resend in ${seconds}s`);
            }
        }
    }
    
    function clearOTPTimer() {
        if (otpTimer) {
            clearInterval(otpTimer);
            otpTimer = null;
            
            const $btn = $('#cod_send_otp');
            $btn.prop('disabled', false)
                .removeClass('cod-btn-timer-active')
                .addClass('cod-btn-primary')
                .text('Send OTP');
        }
    }
    
    // ===== PAYMENT MODAL FUNCTIONALITY =====
    
    function createPaymentModal() {
        if (paymentModal) {
            return paymentModal;
        }
        
        const modalHTML = `
            <div id="cod-payment-modal" class="cod-payment-modal" style="display: none;">
                <div class="cod-payment-modal-overlay"></div>
                <div class="cod-payment-modal-content">
                    <div class="cod-payment-modal-header">
                        <h3>₹1 Token Payment</h3>
                        <button type="button" class="cod-payment-modal-close">&times;</button>
                    </div>
                    <div class="cod-payment-modal-body">
                        <div class="cod-payment-tabs">
                            <button type="button" id="cod-tab-qr" class="cod-payment-tab">
                                <span class="cod-tab-icon">📱</span>
                                Scan QR Code
                            </button>
                            <button type="button" id="cod-tab-app" class="cod-payment-tab">
                                <span class="cod-tab-icon">💳</span>
                                Pay via App
                            </button>
                        </div>
                        <div class="cod-payment-content">
                            <div id="cod-payment-qr-section" class="cod-payment-section">
                                <div class="cod-qr-container">
                                    <div id="cod-qr-code"></div>
                                    <p class="cod-qr-instructions">Scan this QR code with any UPI app to pay ₹1</p>
                                </div>
                            </div>
                            <div id="cod-payment-app-section" class="cod-payment-section" style="display: none;">
                                <div class="cod-app-container">
                                    <p class="cod-app-instructions">Click the button below to open your UPI app</p>
                                    <button type="button" id="cod-proceed-payment" class="cod-btn cod-btn-primary cod-btn-large">
                                        Proceed to Pay ₹1
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="cod-payment-info">
                            <div id="cod-payment-status" class="cod-payment-status"></div>
                            <div class="cod-payment-timer">
                                <span id="cod-payment-countdown">Payment expires in 2:00</span>
                            </div>
                            <div class="cod-payment-note">
                                <small>💡 ₹1 will be automatically refunded after verification</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(modalHTML);
        paymentModal = $('#cod-payment-modal');
        
        // Add modal styles
        addPaymentModalStyles();
        
        // Bind events
        bindPaymentModalEvents();
        
        return paymentModal;
    }
    
    function addPaymentModalStyles() {
        if ($('#cod-payment-modal-styles').length > 0) return;
        
        const styles = `
            <style id="cod-payment-modal-styles">
                .cod-payment-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                }
                
                .cod-payment-modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(2px);
                }
                
                .cod-payment-modal-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                    max-width: 500px;
                    width: 90%;
                    max-height: 90vh;
                    overflow: hidden;
                    animation: modalSlideIn 0.3s ease-out;
                }
                
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -60%);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%);
                    }
                }
                
                .cod-payment-modal-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 1.25rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .cod-payment-modal-header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    font-weight: 600;
                }
                
                .cod-payment-modal-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background-color 0.2s;
                }
                
                .cod-payment-modal-close:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                
                .cod-payment-modal-body {
                    padding: 0;
                }
                
                .cod-payment-tabs {
                    display: flex;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .cod-payment-tab {
                    flex: 1;
                    padding: 0.9375rem 1.25rem;
                    border: none;
                    background: #f8fafc;
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #64748b;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                
                .cod-payment-tab:hover {
                    background: #e2e8f0;
                }
                
                .cod-payment-tab.active {
                    background: white;
                    color: #1e293b;
                    border-bottom: 2px solid #667eea;
                }
                
                .cod-tab-icon {
                    font-size: 1rem;
                }
                
                .cod-payment-content {
                    padding: 1.875rem;
                }
                
                .cod-payment-section {
                    text-align: center;
                }
                
                .cod-qr-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.25rem;
                }
                
                #cod-qr-code {
                    padding: 1.25rem;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 2px dashed #cbd5e1;
                    display: inline-block;
                }
                
                .cod-qr-instructions {
                    margin: 0;
                    color: #64748b;
                    font-size: 0.875rem;
                }
                
                .cod-app-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.25rem;
                }
                
                .cod-app-instructions {
                    margin: 0;
                    color: #64748b;
                    font-size: 0.875rem;
                }
                
                .cod-payment-info {
                    margin-top: 1.25rem;
                    padding-top: 1.25rem;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                }
                
                .cod-payment-status {
                    margin-bottom: 0.625rem;
                    font-size: 0.875rem;
                }
                
                .cod-payment-status.success {
                    color: #059669;
                }
                
                .cod-payment-status.error {
                    color: #dc2626;
                }
                
                .cod-payment-timer {
                    margin-bottom: 0.625rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #f59e0b;
                }
                
                .cod-payment-note {
                    color: #64748b;
                    font-size: 0.75rem;
                }
                
                .cod-btn {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-decoration: none;
                    display: inline-block;
                }
                
                .cod-btn-primary {
                    background: #667eea;
                    color: white;
                }
                
                .cod-btn-primary:hover {
                    background: #5a67d8;
                }
                
                .cod-btn-large {
                    padding: 0.9375rem 1.875rem;
                    font-size: 1rem;
                }
                
                .cod-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                @media (max-width: 768px) {
                    .cod-payment-modal-content {
                        width: 95%;
                        margin: 1.25rem;
                    }
                    
                    .cod-payment-content {
                        padding: 1.25rem;
                    }
                    
                    .cod-payment-tab {
                        padding: 0.75rem 0.9375rem;
                        font-size: 0.8125rem;
                    }
                    
                    .cod-payment-modal-header h3 {
                        font-size: 1rem;
                    }
                }
            </style>
        `;
        
        $('head').append(styles);
    }
    
    function bindPaymentModalEvents() {
        // Close modal
        $(document).on('click', '.cod-payment-modal-close, .cod-payment-modal-overlay', function() {
            closePaymentModal();
        });
        
        // Tab switching
        $(document).on('click', '#cod-tab-qr', function() {
            switchPaymentTab('qr');
        });
        
        $(document).on('click', '#cod-tab-app', function() {
            switchPaymentTab('app');
        });
        
        // Proceed to payment
        $(document).on('click', '#cod-proceed-payment', function() {
            if (window.currentPaymentUrl) {
                window.location.href = window.currentPaymentUrl;
            }
        });
        
        // Escape key to close
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' && paymentModal && paymentModal.is(':visible')) {
                closePaymentModal();
            }
        });
    }
    
    function openPaymentModal() {
        if (!paymentModal) {
            createPaymentModal();
        }
        
        // Reset modal state
        $('#cod-payment-status').removeClass('success error').text('');
        $('#cod-qr-code').empty();
        window.currentPaymentUrl = null;
        
        // CRITICAL FIX: Device-based default tab selection
        const isMobile = window.innerWidth <= 768;
        switchPaymentTab(isMobile ? 'app' : 'qr');
        
        // Show modal
        paymentModal.fadeIn(300);
        
        // Create payment link
        createPaymentLink();
    }
    
    function closePaymentModal() {
        if (paymentModal) {
            paymentModal.fadeOut(300);
        }
        
        // CRITICAL FIX: Clear timer and re-enable button on modal close
        clearTokenTimer();
        
        // Re-enable pay button and reset text
        const $payBtn = $('#cod_pay_token');
        $payBtn.prop('disabled', false).text('Pay ₹1 Token').removeClass('verified');
    }
    
    function switchPaymentTab(tab) {
        if (tab === 'qr') {
            $('#cod-tab-qr').addClass('active');
            $('#cod-tab-app').removeClass('active');
            $('#cod-payment-qr-section').show();
            $('#cod-payment-app-section').hide();
        } else {
            $('#cod-tab-app').addClass('active');
            $('#cod-tab-qr').removeClass('active');
            $('#cod-payment-qr-section').hide();
            $('#cod-payment-app-section').show();
        }
    }
    
    function createPaymentLink() {
        $('#cod-payment-status').text('Creating payment link...');
        
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_create_payment_link',
                nonce: codVerifier.nonce
            },
            success: function(response) {
                if (response.success) {
                    const data = response.data;
                    window.currentPaymentUrl = data.short_url;
                    
                    if (data.test_mode) {
                        $('#cod-payment-status').addClass('success').text('Test mode: Payment link created');
                        generateTestQR(data.short_url);
                    } else {
                        $('#cod-payment-status').addClass('success').text('Payment link created successfully');
                        
                        // CRITICAL FIX: Dynamic QR code rendering using fetched short_url
                        if ($('#cod-tab-qr').hasClass('active')) {
                            renderQRCode(data.short_url);
                        } else {
                            renderMobileRedirect(data.short_url);
                        }
                    }
                    
                    // CRITICAL FIX: Start 2-minute timer only after successful link creation
                    startTokenTimer(120);
                    
                    // Set up tab click handlers with fetched URL
                    $('#cod-tab-qr').off('click').on('click', function() {
                        switchPaymentTab('qr');
                        renderQRCode(data.short_url);
                    });
                    
                    $('#cod-tab-app').off('click').on('click', function() {
                        switchPaymentTab('app');
                        renderMobileRedirect(data.short_url);
                    });
                    
                } else {
                    $('#cod-payment-status').addClass('error').text(response.data || 'Failed to create payment link');
                }
            },
            error: function() {
                $('#cod-payment-status').addClass('error').text('Network error. Please try again.');
            }
        });
    }
    
    // CRITICAL FIX: Dynamic QR Code Rendering
    function renderQRCode(url) {
        const qrBox = document.getElementById('cod-qr-code');
        if (!qrBox) return;
        
        qrBox.innerHTML = ''; // Clear previous content
        
        // Check if QRCode library is available
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrBox, {
                text: url,
                width: 220,
                height: 220,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            $('#cod-payment-status').text('Scan QR with UPI app. ₹1 will be refunded after payment.');
        } else {
            console.error("QRCode.js library not loaded.");
            // Fallback: Use online QR code generator
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
            qrBox.innerHTML = `<img src="${qrUrl}" alt="Payment QR Code" style="max-width: 220px; border-radius: 8px;">`;
            $('#cod-payment-status').text('Scan QR with UPI app. ₹1 will be refunded after payment.');
        }
    }
    
    // CRITICAL FIX: Mobile Redirect Implementation
    function renderMobileRedirect(url) {
        const appContainer = document.querySelector('.cod-app-container');
        if (!appContainer) return;
        
        // Clear previous content
        const proceedBtn = document.getElementById('cod-proceed-payment');
        if (proceedBtn) {
            proceedBtn.onclick = function() {
                window.location.href = url; // Redirect to the payment link
            };
        }
        
        $('#cod-payment-status').text('You will be redirected to UPI app or payment page.');
    }
    
    function generateTestQR(url) {
        // For test mode, create a simple placeholder QR
        $('#cod-qr-code').html(`
            <div style="width: 220px; height: 220px; background: #f0f0f0; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #666; font-size: 0.875rem; text-align: center;">
                TEST QR CODE<br>
                <small>Scan with UPI app</small>
            </div>
        `);
    }
    
    function startTokenTimer(duration) {
        let timeLeft = duration;
        
        function updateTimer() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            $('#cod-payment-countdown').text(`Payment expires in ${displayTime}`);
            
            if (timeLeft <= 0) {
                clearTokenTimer();
                $('#cod-payment-status').removeClass('success').addClass('error').text('Payment session expired. You can retry.');
                $('#cod-payment-countdown').text('Payment expired');
            }
            
            timeLeft--;
        }
        
        updateTimer(); // Update immediately
        tokenTimer = setInterval(updateTimer, 1000);
    }
    
    function clearTokenTimer() {
        if (tokenTimer) {
            clearInterval(tokenTimer);
            tokenTimer = null;
        }
    }
    
    // ===== UTILITY FUNCTIONS =====
    
    function getSelectedPaymentMethod() {
        let selectedMethod = null;
        
        const selectors = [
            'input#radio-control-wc-payment-method-options-cod:checked',
            'input[name="payment_method"]:checked',
            '.wc-block-components-radio-control__input:checked',
            'input[name*="radio-control-wc-payment-method"]:checked',
            'input[name*="payment-method"]:checked',
            'input.wc-payment-method-input:checked'
        ];
        
        for (let selector of selectors) {
            const $input = $(selector);
            if ($input.length > 0) {
                selectedMethod = $input.val();
                if (selectedMethod) break;
            }
        }
        
        console.log('COD Verifier: Selected payment method:', selectedMethod);
        return selectedMethod;
    }
    
    function createVerificationBox() {
        if (verificationBoxCreated) {
            return $('#cod-verifier-wrapper-active');
        }
        
        const $template = $('#cod-verification-template #cod-verifier-wrapper');
        if ($template.length === 0) {
            console.error('COD Verifier: Template not found in DOM');
            return $();
        }
        
        const $clonedBox = $template.clone();
        $clonedBox.attr('id', 'cod-verifier-wrapper-active');
        
        let $insertionPoint = null;
        
        if (isBlockCheckout) {
            const blockSelectors = [
                '.wc-block-checkout__actions_row',
                '.wc-block-components-checkout-place-order-button',
                '.wp-block-woocommerce-checkout-order-summary-block'
            ];
            
            for (let selector of blockSelectors) {
                $insertionPoint = $(selector).first();
                if ($insertionPoint.length > 0) {
                    console.log('COD Verifier: Found insertion point:', selector);
                    break;
                }
            }
        } else {
            const classicSelectors = [
                '#order_review',
                '.woocommerce-checkout-review-order',
                '#place_order'
            ];
            
            for (let selector of classicSelectors) {
                $insertionPoint = $(selector).first();
                if ($insertionPoint.length > 0) {
                    console.log('COD Verifier: Found insertion point:', selector);
                    break;
                }
            }
        }
        
        if ($insertionPoint && $insertionPoint.length > 0) {
            $insertionPoint.before($clonedBox);
            verificationBoxCreated = true;
            
            // Initialize country code change handler
            initializeCountryCodeHandler();
            
            console.log('COD Verifier: Verification box created');
            return $clonedBox;
        } else {
            console.error('COD Verifier: No suitable insertion point found');
            return $();
        }
    }
    
    function initializeCountryCodeHandler() {
        // Update helper text when country code changes
        $(document).on('change', '#cod_country_code', function() {
            updatePhoneHelperText();
            // Clear phone input when country changes
            $('#cod_phone').val('');
            // Clear any existing messages
            $('#cod_otp_message').removeClass('success error').hide();
        });
        
        // Initialize helper text
        updatePhoneHelperText();
    }
    
    function createWarningMessage() {
        if (warningMessageCreated) {
            return $('#cod-verification-warning-active');
        }
        
        const warningHTML = `
            <div id="cod-verification-warning-active" class="cod-verification-warning" style="display: none;">
                <div class="cod-warning-content">
                    <span class="cod-warning-icon">⚠️</span>
                    <span class="cod-warning-text">Please complete verification before placing the order.</span>
                </div>
            </div>
        `;
        
        let $insertionPoint = null;
        
        if (isBlockCheckout) {
            const blockSelectors = [
                '.wc-block-checkout__actions_row',
                '.wc-block-components-checkout-place-order-button',
                '.wp-block-woocommerce-checkout-order-summary-block'
            ];
            
            for (let selector of blockSelectors) {
                $insertionPoint = $(selector).first();
                if ($insertionPoint.length > 0) {
                    console.log('COD Verifier: Found warning insertion point:', selector);
                    break;
                }
            }
        } else {
            const classicSelectors = [
                '#order_review',
                '.woocommerce-checkout-review-order',
                '#place_order'
            ];
            
            for (let selector of classicSelectors) {
                $insertionPoint = $(selector).first();
                if ($insertionPoint.length > 0) {
                    console.log('COD Verifier: Found warning insertion point:', selector);
                    break;
                }
            }
        }
        
        if ($insertionPoint && $insertionPoint.length > 0) {
            $insertionPoint.after(warningHTML);
            warningMessageCreated = true;
            console.log('COD Verifier: Warning message created');
            return $('#cod-verification-warning-active');
        } else {
            console.error('COD Verifier: No suitable insertion point found for warning message');
            return $();
        }
    }
    
    function updateVerificationWarning() {
        const selectedMethod = getSelectedPaymentMethod();
        const isCODSelected = selectedMethod === 'cod' || selectedMethod === 'cash_on_delivery';
        
        let $warningMessage = $('#cod-verification-warning-active');
        if ($warningMessage.length === 0) {
            $warningMessage = createWarningMessage();
        }
        
        if ($warningMessage.length === 0) return;
        
        if (isCODSelected) {
            let verificationComplete = true;
            
            if (codVerifier.enableOTP === '1' && !window.codVerifierStatus.otpVerified) {
                verificationComplete = false;
            }
            
            if (codVerifier.enableToken === '1' && (!window.codVerifierStatus.tokenVerified || !$('#cod_token_confirmed').is(':checked'))) {
                verificationComplete = false;
            }
            
            if (verificationComplete) {
                $warningMessage.fadeOut(300);
                console.log('COD Verifier: Warning message hidden - verification complete');
            } else {
                $warningMessage.fadeIn(300);
                console.log('COD Verifier: Warning message shown - verification incomplete');
            }
        } else {
            $warningMessage.fadeOut(300);
            console.log('COD Verifier: Warning message hidden - non-COD selected');
        }
    }
    
    function updateHiddenFields() {
        $('input[name="cod_otp_verified"]').remove();
        $('input[name="cod_token_verified"]').remove();
        
        const $checkoutForm = $('form.checkout, form.wc-block-checkout__form').first();
        if ($checkoutForm.length > 0) {
            $checkoutForm.append('<input type="hidden" name="cod_otp_verified" value="' + (window.codVerifierStatus.otpVerified ? '1' : '0') + '">');
            $checkoutForm.append('<input type="hidden" name="cod_token_verified" value="' + (window.codVerifierStatus.tokenVerified ? '1' : '0') + '">');
        }

        console.log('COD Verifier: Hidden fields updated - OTP:', window.codVerifierStatus.otpVerified, 'Token:', window.codVerifierStatus.tokenVerified);
    }
    
    function updateVerificationStatus() {
        if (codVerifier.enableOTP === '1') {
            const otpBadge = $('#cod-otp-badge');
            if (otpBadge.length) {
                if (window.codVerifierStatus.otpVerified) {
                    otpBadge.text('✓ Verified').removeClass('pending').addClass('verified');
                } else {
                    otpBadge.text('Pending').removeClass('verified').addClass('pending');
                }
            }
        }

        if (codVerifier.enableToken === '1') {
            const tokenBadge = $('#cod-token-badge');
            if (tokenBadge.length) {
                if (window.codVerifierStatus.tokenVerified) {
                    tokenBadge.text('✓ Completed').removeClass('pending').addClass('verified');
                } else {
                    tokenBadge.text('Pending').removeClass('verified').addClass('pending');
                }
            }
        }

        updateHiddenFields();
        updatePlaceOrderButtonState();
        updateVerificationWarning();
    }
    
    function showMessage(type, message, status) {
        const $messageElement = $('#cod_' + type + '_message');
        $messageElement.removeClass('success error').addClass(status).html(message).show();
    }

    function updatePlaceOrderButtonState() {
        console.log('COD Verifier: updatePlaceOrderButtonState triggered.');
        const $placeOrderButton = $('#place_order, .wc-block-components-checkout-place-order-button, button[type="submit"]');
        const isCODSelectedNow = $('input#radio-control-wc-payment-method-options-cod:checked, input[name="payment_method"][value="cod"]:checked, input[name="payment_method"]:checked[value="cash_on_delivery"], .wc-block-components-radio-control__input:checked[value="cod"], .wc-block-components-radio-control__input:checked[value="cash_on_delivery"], input[name*="radio-control-wc-payment-method"]:checked[value="cod"], input[name*="radio-control-wc-payment-method"]:checked[value="cash_on_delivery"], input[name*="payment-method"]:checked[value="cod"], input[name*="payment-method"]:checked[value="cash_on_delivery"], input.wc-payment-method-input:checked[value="cod"], input.wc-payment-method-input:checked[value="cash_on_delivery"]').length > 0;

        console.log('COD Verifier: isCODSelectedNow:', isCODSelectedNow);
        
        if (isCODSelectedNow) {
            console.log('COD Verifier: COD selected, checking verification status for button state.');
            let canPlaceOrder = true;

            if (codVerifier.enableOTP === '1' && !window.codVerifierStatus.otpVerified) {
                canPlaceOrder = false;
            }

            const isTokenConfirmed = $('#cod_token_confirmed').is(':checked');
            if (codVerifier.enableToken === '1' && (!window.codVerifierStatus.tokenVerified || !isTokenConfirmed)) {
                 canPlaceOrder = false;
            }

            console.log('COD Verifier: canPlaceOrder:', canPlaceOrder);

            if (canPlaceOrder) {
                $placeOrderButton.prop('disabled', false).removeClass('disabled');
                console.log('COD Verifier: Verification complete, enabling place order button.');
            } else {
                $placeOrderButton.prop('disabled', true).addClass('disabled');
                console.log('COD Verifier: Verification incomplete, disabling place order button.');
            }
        } else {
            $placeOrderButton.prop('disabled', false).removeClass('disabled');
            console.log('COD Verifier: Non-COD selected, enabling place order button.');
        }
        
        updateVerificationWarning();
    }
    
    // ===== PAYMENT METHOD HANDLING =====
    
    function handlePaymentMethodChange() {
        const selectedMethod = getSelectedPaymentMethod();
        
        if (selectedMethod === 'cod' || selectedMethod === 'cash_on_delivery') {
            console.log('COD Verifier: COD selected, showing verification box.');
            showVerificationBox();
        } else {
            console.log('COD Verifier: Non-COD selected, hiding verification box.');
            hideVerificationBox();
        }
        updatePlaceOrderButtonState();
    }
    
    function showVerificationBox() {
        let $wrapper = $('#cod-verifier-wrapper-active');
        
        if ($wrapper.length === 0) {
            $wrapper = createVerificationBox();
        }
        
        if ($wrapper.length > 0) {
            $wrapper.show();
            console.log('COD Verifier: Verification box shown');
            populatePhoneFromBilling();
            updateVerificationStatus();
        }
    }
    
    function hideVerificationBox() {
        const $wrapper = $('#cod-verifier-wrapper-active');
        if ($wrapper.length > 0) {
            $wrapper.hide();
            console.log('COD Verifier: Verification box hidden');
            resetVerificationStates();
        }
    }
    
    function populatePhoneFromBilling() {
        const phoneSelectors = ['#billing_phone', 'input[name*="billing-phone"]', 'input[name*="phone"]'];
        let billingPhone = '';
        
        for (let selector of phoneSelectors) {
            const $phone = $(selector);
            if ($phone.length > 0 && $phone.val()) {
                billingPhone = $phone.val();
                break;
            }
        }
        
        // Extract just the number part if it contains country code
        if (billingPhone) {
            // Remove common prefixes and non-digits
            let cleanPhone = billingPhone.replace(/^\+?91|^\+?1|^\+?44|^0/, '').replace(/\D/g, '');
            
            if (cleanPhone && !$('#cod_phone').val()) {
                $('#cod_phone').val(cleanPhone);
            }
        }
    }
    
    function resetVerificationStates() {
        window.codVerifierStatus.otpVerified = false;
        window.codVerifierStatus.tokenVerified = false;
        $('#cod_otp').val('');
        $('#cod_phone').val('');
        $('#cod_token_confirmed').prop('checked', false);
        $('#cod_otp_message').removeClass('success error').hide();
        $('#cod_token_message').removeClass('success error').hide();
        $('#cod_verify_otp').prop('disabled', true).text('Verify').removeClass('verified');
        $('#cod_pay_token').text('Pay ₹1 Token').removeClass('verified');
        
        // Clear timers
        clearOTPTimer();
        clearTokenTimer();
        
        updateHiddenFields();
        updateVerificationStatus();
    }
    
    // ===== EVENT LISTENERS FOR PAYMENT METHOD CHANGES =====

    $(document).on('change', 'input[name="payment_method"], .wc-block-components-radio-control__input, input[name*="radio-control-wc-payment-method"], input[name*="payment-method"], input.wc-payment-method-input', handlePaymentMethodChange);

    $(document.body).on('updated_checkout', function() {
        console.log('COD Verifier: updated_checkout triggered');
        setTimeout(updatePlaceOrderButtonState, 300);
        setTimeout(handlePaymentMethodChange, 350);
    });

    $(document).on('change', '#payment, #order_review, .wc-block-checkout', function() {
         console.log('COD Verifier: Payment method section change detected');
         setTimeout(updatePlaceOrderButtonState, 200);
         setTimeout(handlePaymentMethodChange, 250);
    });

    // Initial checks
    setTimeout(updatePlaceOrderButtonState, 100);
    setTimeout(handlePaymentMethodChange, 150);
    setTimeout(updatePlaceOrderButtonState, 600);
    setTimeout(handlePaymentMethodChange, 650);
    setTimeout(updatePlaceOrderButtonState, 1500);
    setTimeout(handlePaymentMethodChange, 1550);

    // ===== ENHANCED OTP VERIFICATION HANDLERS =====
    
    $(document).on('click', '#cod_send_otp', function(e) {
        e.preventDefault();
        
        const $btn = $(this);

        // Prevent sending if button is disabled (cooldown active)
        if ($btn.is(':disabled')) {
            console.log('COD Verifier: Send OTP button is disabled, preventing resend.');
            return;
        }

        const countryCode = $('#cod_country_code').val();
        const phoneNumber = $('#cod_phone').val().trim();
        
        // Validate phone number
        const validation = validatePhoneNumber(countryCode, phoneNumber);
        if (!validation.valid) {
            showMessage('otp', validation.message, 'error');
            return;
        }
        
        // Create full E.164 format phone number
        const fullPhone = countryCode + phoneNumber;
        
        $btn.prop('disabled', true).text('Sending...');
        
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_send_otp',
                phone: fullPhone,
                country_code: countryCode,
                phone_number: phoneNumber,
                nonce: codVerifier.nonce
            },
            success: function(response) {
                if (response.success) {
                    showMessage('otp', response.data.message, 'success');
                    if (response.data.test_mode && response.data.otp) {
                        alert('TEST MODE - Your OTP is: ' + response.data.otp);
                    }
                    
                    // Start timer with configured duration
                    startOTPTimer(settings.otpTimerDuration);
                    
                    // Enable OTP input
                    $('#cod_otp').prop('disabled', false).focus();
                } else {
                    showMessage('otp', response.data, 'error');
                    $btn.prop('disabled', false).text('Send OTP');
                }
            },
            error: function() {
                showMessage('otp', 'Failed to send OTP. Please try again.', 'error');
                $btn.prop('disabled', false).text('Send OTP');
            }
        });
    });
    
    $(document).on('input', '#cod_otp', function() {
        const otp = $(this).val().trim();
        $('#cod_verify_otp').prop('disabled', otp.length !== 6);
    });
    
    $(document).on('click', '#cod_verify_otp', function(e) {
        e.preventDefault();
        
        const otp = $('#cod_otp').val().trim();
        const $btn = $(this);
        
        if (!otp || otp.length !== 6) {
            showMessage('otp', 'Please enter a valid 6-digit OTP', 'error');
            return;
        }
        
        $btn.prop('disabled', true).text('Verifying...');
        
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_verify_otp',
                otp: otp,
                nonce: codVerifier.nonce
            },
            success: function(response) {
                if (response.success) {
                    showMessage('otp', response.data, 'success');
                    window.codVerifierStatus.otpVerified = true;
                    $btn.text('✓ Verified').addClass('verified');
                    
                    // Clear timer since verification is complete
                    clearOTPTimer();
                    
                    updateVerificationStatus();
                } else {
                    showMessage('otp', response.data, 'error');
                    $btn.prop('disabled', false).text('Verify');
                }
            },
            error: function() {
                showMessage('otp', 'Failed to verify OTP. Please try again.', 'error');
                $btn.prop('disabled', false).text('Verify');
            }
        });
    });
    
    // ===== NEW: RAZORPAY TOKEN PAYMENT HANDLERS =====
    
    $(document).on('click', '#cod_pay_token', function(e) {
        e.preventDefault();
        
        const $btn = $(this);
        
        // Don't prevent if user wants to retry after expiry
        if ($btn.hasClass('verified')) {
            return; // Already verified, do nothing
        }
        
        // Open payment modal
        openPaymentModal();
    });

    $(document).on('change', '#cod_token_confirmed', function() {
          console.log('COD Verifier: Token confirmed checkbox changed.');
          updatePlaceOrderButtonState();
     });
    
    // ===== CRITICAL VALIDATION FUNCTION =====
    
    function preventOrderPlacement(e) {
        console.log('COD Verifier: preventOrderPlacement triggered (final button check). ');
        const $placeOrderButton = $('#place_order, .wc-block-components-checkout-place-order-button, button[type="submit"]');

        if ($placeOrderButton.is(':disabled')) {
            console.log('COD Verifier: Order placement prevented by disabled button.');
            if (e && typeof e.preventDefault === 'function') {
                 e.preventDefault();
                 if (typeof e.stopImmediatePropagation === 'function') {
                      e.stopImmediatePropagation();
                 }
                 if (typeof e.stopPropagation === 'function') {
                      e.stopPropagation();
                 }
            }

            const selectedMethod = getSelectedPaymentMethod();
            if (selectedMethod === 'cod' || selectedMethod === 'cash_on_delivery') {
                 let errors = [];
                 if (codVerifier.enableOTP === '1' && !window.codVerifierStatus.otpVerified) {
                     errors.push('• Phone number verification via OTP');
                 }
                 if (codVerifier.enableToken === '1' && (!window.codVerifierStatus.tokenVerified || !$('#cod_token_confirmed').is(':checked'))) {
                     errors.push('• ₹1 token payment completion and confirmation');
                 }
                 
                 if (errors.length > 0) {
                    const message = 'Please complete the following steps:\n' + errors.join('\n');
                    alert(message);
                    
                    const $verificationBox = $('#cod-verifier-wrapper-active');
                    if ($verificationBox.length > 0 && $verificationBox.is(':visible')) {
                        $('html, body').animate({
                            scrollTop: $verificationBox.offset().top - 100
                        }, 500);
                    }
                 }
            }

            return false;
        }

        console.log('COD Verifier: PreventOrderPlacement check passed, allowing order.');
        return true;
    }
    
    // ===== COMPREHENSIVE VALIDATION EVENT LISTENERS =====

    $(document).on('click', '#place_order, .wc-block-components-checkout-place-order-button, button[type="submit"]', function(e) {
        console.log('COD Verifier: Order placement attempted via click');
        if (!preventOrderPlacement(e)) {
             e.preventDefault();
             e.stopImmediatePropagation();
             e.stopPropagation();
             return false;
        }
    });

    $(document).on('submit', 'form.checkout, form.wc-block-checkout__form, form[name="checkout"]', function(e) {
        console.log('COD Verifier: Form submission attempted');
        if (!preventOrderPlacement(e)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
            return false;
        }
    });

    $(document).on('checkout_place_order', function(e) {
        console.log('COD Verifier: WooCommerce checkout_place_order event');
        if (!preventOrderPlacement(e)) {
             e.preventDefault();
             e.stopImmediatePropagation();
             return false;
        }
        return true;
    });

    $(document).on('checkout_place_order_cod', function(e) {
        console.log('COD Verifier: WooCommerce checkout_place_order_cod event');
        if (!preventOrderPlacement(e)) {
             e.preventDefault();
             e.stopImmediatePropagation();
             return false;
        }
        return true;
    });

    $('form.checkout').on('checkout_place_order', function(e) {
        console.log('COD Verifier: Classic checkout form validation');
        if (!preventOrderPlacement(e)) {
             e.preventDefault();
             e.stopImmediatePropagation();
             return false;
        }
        return true;
    });

    // Additional safety net - continuous validation
    setInterval(function() {
        const selectedMethod = getSelectedPaymentMethod();
        if (selectedMethod === 'cod' || selectedMethod === 'cash_on_delivery') {
            updateHiddenFields();
        } else {
             const $placeOrderButton = $('#place_order, .wc-block-components-checkout-place-order-button, button[type="submit"]');
             if ($placeOrderButton.is(':disabled')) {
                  $placeOrderButton.prop('disabled', false).removeClass('disabled');
                  console.log('COD Verifier: Interval check: Non-COD selected, ensuring button is enabled.');
             }
        }
    }, 1500);

    // Cleanup on page unload
    $(window).on('beforeunload', function() {
        clearOTPTimer();
        clearTokenTimer();
    });

    // CRITICAL FIX: Load QRCode.js library if not already loaded
    if (typeof QRCode === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.async = true;
        script.onload = function() {
            console.log('COD Verifier: QRCode.js library loaded successfully');
        };
        script.onerror = function() {
            console.error('COD Verifier: Failed to load QRCode.js library');
        };
        document.head.appendChild(script);
    }
});