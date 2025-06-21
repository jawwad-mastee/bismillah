
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

declare global {
  interface Window {
    Razorpay?: any;
    cod_verifier_ajax?: {
      enable_otp: string;
      enable_token: string;
      is_test_mode: string;
      razorpay_key: string;
    };
  }
}

const Index = () => {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [isTokenPaid, setIsTokenPaid] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  const settings = window.cod_verifier_ajax;
  const enableOTP = settings?.enable_otp === '1';
  const enableToken = settings?.enable_token === '1';
  const isTestMode = settings?.is_test_mode === '1';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleSendOTP = async () => {
    if (!phone || phone.length !== 10) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit mobile number",
        variant: "destructive",
      });
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid Indian mobile number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.sendOTP(phone);
      
      if (response.success) {
        setIsOTPSent(true);
        setOtpTimer(30);
        
        toast({
          title: "OTP Sent",
          description: response.message,
        });

        // In test mode, show OTP via alert
        if (response.test_mode && response.otp) {
          setTimeout(() => {
            alert(`TEST MODE - Your OTP is: ${response.otp}`);
          }, 500);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send OTP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.verifyOTP(otp);
      
      if (response.success) {
        setIsOTPVerified(true);
        toast({
          title: "Success",
          description: response.message,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "OTP verification failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTokenPayment = async () => {
    if (isTestMode) {
      // Simulate payment in test mode
      setLoading(true);
      try {
        setTimeout(async () => {
          const response = await api.verifyTokenPayment({});
          if (response.success) {
            setIsTokenPaid(true);
            toast({
              title: "Success",
              description: response.message,
            });
          }
          setLoading(false);
        }, 1500);
      } catch (error) {
        toast({
          title: "Error",
          description: "Token payment simulation failed",
          variant: "destructive",
        });
        setLoading(false);
      }
      return;
    }

    // Production Razorpay integration
    setLoading(true);
    try {
      const orderData = await api.createTokenOrder();
      
      if (!window.Razorpay) {
        throw new Error('Razorpay not loaded. Please refresh the page.');
      }

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'COD Token Payment',
        description: '₹1 verification payment for COD order',
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            const verifyResponse = await api.verifyTokenPayment({
              payment_id: response.razorpay_payment_id,
              order_id: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });
            
            if (verifyResponse.success) {
              setIsTokenPaid(true);
              toast({
                title: "Success",
                description: verifyResponse.message,
              });
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Payment verification failed",
              variant: "destructive",
            });
          }
        },
        prefill: {
          contact: phone,
        },
        theme: {
          color: '#3399cc',
        },
        modal: {
          ondismiss: () => {
            toast({
              title: "Payment Cancelled",
              description: "Please complete the payment to proceed.",
              variant: "destructive",
            });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If this is being loaded in WordPress checkout context, don't render
  if (typeof window !== 'undefined' && document.getElementById('cod-verifier-wrapper')) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>COD Verification</CardTitle>
          <CardDescription>
            Complete OTP and Token verification for Cash on Delivery orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {enableOTP && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">OTP Verification</h3>
              
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={10}
                    disabled={isOTPVerified}
                  />
                  <Button
                    onClick={handleSendOTP}
                    disabled={loading || otpTimer > 0 || isOTPVerified}
                    variant="outline"
                  >
                    {otpTimer > 0 ? `${otpTimer}s` : 'Send OTP'}
                  </Button>
                </div>
              </div>

              {isOTPSent && !isOTPVerified && (
                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium">
                    Enter OTP
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="otp"
                      type="text"
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                    />
                    <Button
                      onClick={handleVerifyOTP}
                      disabled={loading || otp.length !== 6}
                    >
                      Verify
                    </Button>
                  </div>
                </div>
              )}

              {isOTPVerified && (
                <div className="text-green-600 text-sm font-medium">
                  ✓ Phone number verified successfully
                </div>
              )}
            </div>
          )}

          {enableToken && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Token Payment</h3>
              <p className="text-sm text-muted-foreground">
                Complete ₹1 token payment to verify your order
              </p>
              
              <Button
                onClick={handleTokenPayment}
                disabled={loading || isTokenPaid}
                className="w-full"
              >
                {isTokenPaid ? '✓ Payment Complete' : 'Pay ₹1 Token via Razorpay'}
              </Button>
              
              {isTestMode && (
                <p className="text-xs text-muted-foreground text-center">
                  (Test Mode: Payment will be simulated)
                </p>
              )}
              
              {isTokenPaid && (
                <div className="text-green-600 text-sm font-medium">
                  ✓ Token payment completed successfully
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
