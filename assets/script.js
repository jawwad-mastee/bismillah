jQuery(document).ready(function($) {
    'use strict';
    
    // Global variables for COD Verifier
    var codVerifierState = {
        otpSent: false,
        otpVerified: false,
        tokenPaid: false,
        currentTimer: null,
        paymentInProgress: false,
        statusPollingInterval: null,
        currentPaymentId: null
    };
    
    // Initialize COD Verifier when payment method changes
    function initCODVerifier() {
        var selectedPaymentMethod = $('input[name="payment_method"]:checked').val();
        
        if (selectedPaymentMethod === 'cod') {
            showCODVerifier();
        } else {
            hideCODVerifier();
            // Clear any polling when switching away from COD
            clearStatusPolling();
        }
    }
    
    // Show COD verification box
    function showCODVerifier() {
        var $wrapper = $('#cod-verifier-wrapper');
        if ($wrapper.length) {
            $wrapper.attr('id', 'cod-verifier-wrapper-active').show();
            
            // Update phone help text based on selected country
            updatePhoneHelpText();
            
            // Initialize country code change handler
            $('#cod_country_code').off('change.codverifier').on('change.codverifier', function() {
                updatePhoneHelpText();
                $('#cod_phone').val(''); // Clear phone input when country changes
            });
        }
    }
    
    // Hide COD verification box
    function hideCODVerifier() {
        var $wrapper = $('#cod-verifier-wrapper-active');
        if ($wrapper.length) {
            $wrapper.attr('id', 'cod-verifier-wrapper').hide();
        }
    }
    
    // Update phone help text based on selected country
    function updatePhoneHelpText() {
        var countryCode = $('#cod_country_code').val();
        var helpText = '';
        
        switch(countryCode) {
            case '+91':
                helpText = 'Enter 10-digit Indian mobile number (e.g., 7039940998)';
                break;
            case '+1':
                helpText = 'Enter 10-digit US phone number (e.g., 2125551234)';
                break;
            case '+44':
                helpText = 'Enter UK phone number (e.g., 7700900123)';
                break;
            default:
                helpText = 'Select country and enter phone number';
        }
        
        $('#cod_phone_help_text').text(helpText);
    }
    
    // OTP Timer functionality
    function startOTPTimer(duration) {
        var $button = $('#cod_send_otp');
        var $timer = $button;
        var timeLeft = duration;
        
        $button.prop('disabled', true).addClass('cod-btn-timer-active');
        
        codVerifierState.currentTimer = setInterval(function() {
            $timer.text('Resend in ' + timeLeft + 's');
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(codVerifierState.currentTimer);
                $button.prop('disabled', false)
                       .removeClass('cod-btn-timer-active')
                       .text('Send OTP');
            }
        }, 1000);
    }
    
    // Send OTP functionality
    $(document).on('click', '#cod_send_otp', function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var countryCode = $('#cod_country_code').val();
        var phoneNumber = $('#cod_phone').val().trim();
        
        if (!phoneNumber) {
            showMessage('#cod_otp_message', 'Please enter your phone number.', 'error');
            return;
        }
        
        // Construct full phone number in E.164 format
        var fullPhone = countryCode + phoneNumber;
        
        // Basic validation
        if (!validatePhoneNumber(fullPhone, countryCode)) {
            return;
        }
        
        $button.prop('disabled', true).text('Sending...');
        
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_send_otp',
                nonce: codVerifier.nonce,
                phone: fullPhone,
                country_code: countryCode,
                phone_number: phoneNumber
            },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    codVerifierState.otpSent = true;
                    showMessage('#cod_otp_message', response.data.message || response.data, 'success');
                    
                    // Start timer
                    var timerDuration = parseInt(codVerifier.otpTimerDuration) || 30;
                    startOTPTimer(timerDuration);
                    
                    // Enable OTP input and verify button
                    $('#cod_otp').prop('disabled', false);
                    $('#cod_verify_otp').prop('disabled', false);
                    
                    // Show test mode OTP if available
                    if (response.data.test_mode && response.data.otp) {
                        setTimeout(function() {
                            alert('TEST MODE - Your OTP is: ' + response.data.otp);
                        }, 500);
                    }
                    
                    // Update status
                    updateOTPStatus('sent');
                } else {
                    showMessage('#cod_otp_message', response.data, 'error');
                    $button.prop('disabled', false).text('Send OTP');
                }
            },
            error: function() {
                showMessage('#cod_otp_message', 'Failed to send OTP. Please try again.', 'error');
                $button.prop('disabled', false).text('Send OTP');
            }
        });
    });
    
    // Verify OTP functionality
    $(document).on('click', '#cod_verify_otp', function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var otp = $('#cod_otp').val().trim();
        
        if (!otp || otp.length !== 6) {
            showMessage('#cod_otp_message', 'Please enter a valid 6-digit OTP.', 'error');
            return;
        }
        
        $button.prop('disabled', true).text('Verifying...');
        
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_verify_otp',
                nonce: codVerifier.nonce,
                otp: otp
            },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    codVerifierState.otpVerified = true;
                    showMessage('#cod_otp_message', response.data, 'success');
                    
                    // Update button to verified state
                    $button.removeClass('cod-btn-success').addClass('cod-btn-success verified')
                           .text('✓ Verified').prop('disabled', true);
                    
                    // Update status
                    updateOTPStatus('verified');
                    
                    // Disable OTP input
                    $('#cod_otp').prop('disabled', true);
                    
                    // Check if we can enable place order
                    checkAndEnablePlaceOrder();
                } else {
                    showMessage('#cod_otp_message', response.data, 'error');
                    $button.prop('disabled', false).text('Verify');
                }
            },
            error: function() {
                showMessage('#cod_otp_message', 'Failed to verify OTP. Please try again.', 'error');
                $button.prop('disabled', false).text('Verify');
            }
        });
    });
    
    // MODIFIED: Token Payment with Razorpay Standard Checkout
    $(document).on('click', '#cod_pay_token', function(e) {
        e.preventDefault();
        
        if (codVerifierState.paymentInProgress) {
            return;
        }
        
        var $button = $(this);
        codVerifierState.paymentInProgress = true;
        
        // Disable button and show processing state
        $button.prop('disabled', true).text('Processing Payment...');
        
        // Create Razorpay Order
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_create_payment_link',
                nonce: codVerifier.nonce
            },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    // Initialize Razorpay Checkout
                    initializeRazorpayCheckout(response.data, $button);
                } else {
                    showMessage('#cod_token_message', response.data, 'error');
                    resetTokenButton($button);
                }
            },
            error: function() {
                showMessage('#cod_token_message', 'Failed to create payment order. Please try again.', 'error');
                resetTokenButton($button);
            }
        });
    });
    
    // Initialize Razorpay Checkout
    function initializeRazorpayCheckout(orderData, $button) {
        // Check if Razorpay is loaded
        if (typeof Razorpay === 'undefined') {
            showMessage('#cod_token_message', 'Payment system not loaded. Please refresh the page.', 'error');
            resetTokenButton($button);
            return;
        }
        
        var options = {
            "key": orderData.key_id,
            "amount": orderData.amount,
            "currency": orderData.currency,
            "order_id": orderData.order_id,
            "name": "COD Token Payment",
            "description": "₹1 Token Payment for COD Verification",
            "handler": function (razorpay_response) {
                // Payment successful - handle immediately
                console.log('Razorpay Payment Successful:', razorpay_response);
                
                // Store payment ID for polling
                codVerifierState.currentPaymentId = razorpay_response.razorpay_payment_id;
                
                // Show immediate UI feedback
                displaySuccessAnimation();
                
                // Start polling for payment status
                startPaymentStatusPolling(razorpay_response.razorpay_payment_id);
                
                // Verify payment on server
                verifyPaymentOnServer(
                    razorpay_response.razorpay_payment_id,
                    razorpay_response.razorpay_order_id,
                    razorpay_response.razorpay_signature
                );
            },
            "prefill": {
                "name": orderData.customer_name || "",
                "email": orderData.customer_email || "",
                "contact": orderData.customer_phone || ""
            },
            "theme": {
                "color": "#667eea"
            },
            "modal": {
                "ondismiss": function() {
                    resetTokenButton($button);
                    showMessage('#cod_token_message', 'Payment cancelled. Please complete the payment to proceed.', 'error');
                }
            }
        };
        
        var rzp = new Razorpay(options);
        
        // Handle payment failure
        rzp.on('payment.failed', function (response) {
            console.error('Razorpay Payment Failed:', response);
            var errorMsg = response.error ? response.error.description : 'Payment failed. Please try again.';
            showMessage('#cod_token_message', errorMsg, 'error');
            resetTokenButton($button);
            updateFrontendStatus('failed');
        });
        
        // Open Razorpay checkout
        rzp.open();
    }
    
    // NEW: Start payment status polling
    function startPaymentStatusPolling(paymentId) {
        console.log('Starting payment status polling for:', paymentId);
        
        // Clear any existing polling
        clearStatusPolling();
        
        codVerifierState.statusPollingInterval = setInterval(function() {
            checkPaymentStatus(paymentId);
        }, 3000); // Poll every 3 seconds
        
        // Stop polling after 5 minutes to prevent infinite polling
        setTimeout(function() {
            clearStatusPolling();
        }, 300000); // 5 minutes
    }
    
    // NEW: Check payment status via AJAX
    function checkPaymentStatus(paymentId) {
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_check_payment_status',
                nonce: codVerifier.nonce,
                payment_id: paymentId
            },
            dataType: 'json',
            success: function(response) {
                if (response.success && response.data.status === 'captured') {
                    console.log('Payment status confirmed as captured');
                    
                    // Stop polling
                    clearStatusPolling();
                    
                    // Update UI to success
                    handlePaymentSuccess();
                }
            },
            error: function() {
                console.log('Payment status check failed, will retry...');
            }
        });
    }
    
    // NEW: Handle payment success
    function handlePaymentSuccess() {
        codVerifierState.tokenPaid = true;
        
        // Update UI elements
        updateFrontendStatus('success');
        updateTokenStatus('verified');
        
        // Show success message with refund info
        displayRefundMessage();
        
        // Enable place order button
        enablePlaceOrderButton();
        
        // Auto-close popup after 5 seconds
        setTimeout(function() {
            hidePaymentPopup();
        }, 5000);
        
        showMessage('#cod_token_message', '✅ Payment verified successfully! ₹1 refund initiated automatically.', 'success');
    }
    
    // Clear status polling
    function clearStatusPolling() {
        if (codVerifierState.statusPollingInterval) {
            clearInterval(codVerifierState.statusPollingInterval);
            codVerifierState.statusPollingInterval = null;
        }
    }
    
    // Verify payment on server
    function verifyPaymentOnServer(paymentId, orderId, signature) {
        console.log('Sending payment details to server for verification...');
        
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_verify_token_payment_server',
                nonce: codVerifier.nonce,
                payment_id: paymentId,
                order_id: orderId,
                signature: signature
            },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    console.log('Server verification successful.');
                    // The polling will handle the UI update
                } else {
                    console.error('Server verification failed:', response.data);
                    showMessage('#cod_token_message', 'Payment verification failed. Please contact support.', 'error');
                    updateFrontendStatus('failed');
                }
            },
            error: function(xhr, status, error) {
                console.error('Server verification AJAX error:', error);
                showMessage('#cod_token_message', 'Verification error. Please contact support.', 'error');
                updateFrontendStatus('failed');
            }
        });
    }
    
    // Display success animation
    function displaySuccessAnimation() {
        var $feedback = $('#token-payment-feedback');
        var $animation = $('#success-animation');
        
        if ($feedback.length && $animation.length) {
            $feedback.show();
            $animation.show().addClass('animate-success');
            console.log('Success animation displayed.');
        }
    }
    
    // Display refund message
    function displayRefundMessage() {
        var $refundMsg = $('#refund-info-message');
        if ($refundMsg.length) {
            $refundMsg.text('✅ Your payment is successful. Your money will be refunded shortly.').show();
            console.log('Refund message displayed.');
        }
    }
    
    // Hide payment popup
    function hidePaymentPopup() {
        // Don't hide the entire verification wrapper, just reset feedback elements
        var $feedback = $('#token-payment-feedback');
        var $animation = $('#success-animation');
        var $refundMsg = $('#refund-info-message');
        
        if ($feedback.length) $feedback.hide();
        if ($animation.length) $animation.hide().removeClass('animate-success');
        if ($refundMsg.length) $refundMsg.hide();
        
        console.log('Payment feedback elements hidden.');
    }
    
    // Update frontend status
    function updateFrontendStatus(status) {
        var $statusElement = $('#cod-token-badge');
        if ($statusElement.length) {
            $statusElement.removeClass('pending verified failed').addClass(status);
            
            switch(status) {
                case 'success':
                case 'verified':
                    $statusElement.text('Verified');
                    break;
                case 'failed':
                    $statusElement.text('Failed');
                    break;
                default:
                    $statusElement.text('Pending');
            }
        }
        console.log('Frontend status updated to:', status);
    }
    
    // Enable Place Order button
    function enablePlaceOrderButton() {
        var $placeOrderButton = $('#place_order, button[name="woocommerce_checkout_place_order"], .wc-block-components-checkout-place-order-button');
        if ($placeOrderButton.length) {
            $placeOrderButton.prop('disabled', false).removeClass('disabled');
            console.log('Place Order button enabled.');
        } else {
            console.warn('Could not find Place Order button to enable.');
        }
    }
    
    // Reset token button state
    function resetTokenButton($button) {
        codVerifierState.paymentInProgress = false;
        $button.prop('disabled', false).text('Pay ₹1 Token');
    }
    
    // Update OTP status
    function updateOTPStatus(status) {
        var $badge = $('#cod-otp-badge');
        if ($badge.length) {
            $badge.removeClass('pending verified').addClass(status);
            $badge.text(status === 'verified' ? 'Verified' : (status === 'sent' ? 'Sent' : 'Pending'));
        }
    }
    
    // Update token status
    function updateTokenStatus(status) {
        var $badge = $('#cod-token-badge');
        if ($badge.length) {
            $badge.removeClass('pending verified').addClass(status);
            $badge.text(status === 'verified' ? 'Verified' : 'Pending');
        }
    }
    
    // Phone number validation
    function validatePhoneNumber(fullPhone, countryCode) {
        var patterns = {
            '+91': /^\+91[6-9]\d{9}$/,
            '+1': /^\+1[2-9]\d{9}$/,
            '+44': /^\+447\d{9}$/
        };
        
        var examples = {
            '+91': '+917039940998',
            '+1': '+12125551234',
            '+44': '+447700900123'
        };
        
        if (!patterns[countryCode] || !patterns[countryCode].test(fullPhone)) {
            var example = examples[countryCode] || 'valid format';
            showMessage('#cod_otp_message', 'Please enter a valid phone number (e.g., ' + example + ').', 'error');
            return false;
        }
        
        return true;
    }
    
    // Show message helper
    function showMessage(selector, message, type) {
        var $messageEl = $(selector);
        if ($messageEl.length) {
            $messageEl.removeClass('success error').addClass(type).text(message).show();
        }
    }
    
    // Check if place order can be enabled
    function checkAndEnablePlaceOrder() {
        var otpRequired = codVerifier.enableOTP === '1';
        var tokenRequired = codVerifier.enableToken === '1';
        
        var canPlaceOrder = true;
        
        if (otpRequired && !codVerifierState.otpVerified) {
            canPlaceOrder = false;
        }
        
        if (tokenRequired && !codVerifierState.tokenPaid) {
            canPlaceOrder = false;
        }
        
        if (canPlaceOrder) {
            enablePlaceOrderButton();
        }
    }
    
    // Initialize on payment method change
    $(document).on('change', 'input[name="payment_method"]', function() {
        initCODVerifier();
    });
    
    // Initialize on page load
    $(document).ready(function() {
        initCODVerifier();
    });
    
    // Handle checkout form updates
    $(document.body).on('updated_checkout', function() {
        initCODVerifier();
    });
    
    // Cleanup on page unload
    $(window).on('beforeunload', function() {
        clearStatusPolling();
    });
});