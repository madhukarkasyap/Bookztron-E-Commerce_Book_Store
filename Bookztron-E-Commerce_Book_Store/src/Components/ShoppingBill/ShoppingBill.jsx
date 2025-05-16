import "./ShoppingBill.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart, useToast, useOrders } from "../../index";
import axios from "axios";
import { loadRazorpayScript } from "../../UtilityFunctions/loadRazorpayScript";

function ShoppingBill() {
    const navigate = useNavigate();
    const { userCart, dispatchUserCart } = useCart();
    const { showToast } = useToast();
    const { dispatchUserOrders } = useOrders();

    const [couponName, setCouponName] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("online"); // 'online' or 'cod'

    const DELIVERY_CHARGE = 50;
    let totalDiscount = 0, totalBill = 0;

    userCart.forEach(product => {
        const discount = (product.originalPrice - product.discountedPrice) * product.quantity;
        totalDiscount += discount;
        totalBill += product.discountedPrice * product.quantity;
    });

    const coupon = couponName.trim().toUpperCase();
    const discountFromCoupon = coupon === "BOOKS200" ? 200 : 0;
    const finalBill = Math.max(totalBill - discountFromCoupon + DELIVERY_CHARGE, 0);

    const handleOrderSuccess = async (orderId = "COD_" + Date.now()) => {
        try {
            const newOrderItemsArray = userCart.map(item => ({
                ...item,
                orderId,
                orderDate: new Date().toISOString(),
                paymentMethod
            }));

            await axios.post("https://bookztron-server.vercel.app/api/orders", {
                newOrderItemsArray
            }, {
                headers: { 'x-access-token': localStorage.getItem('token') }
            });

            const { data: emptyCartData } = await axios.patch(
                "https://bookztron-server.vercel.app/api/cart/empty/all",
                {}, { headers: { 'x-access-token': localStorage.getItem('token') } }
            );

            if (emptyCartData.status === 'ok') {
                dispatchUserCart({ type: "UPDATE_USER_CART", payload: [] });
            }

            dispatchUserOrders({ type: "UPDATE_USER_ORDERS", payload: newOrderItemsArray });
            showToast("success", "", `Order placed successfully via ${paymentMethod.toUpperCase()}!`);
            navigate('/orders');
        } catch (err) {
            showToast("error", "", "Failed to process order.");
        }
    };

    const handlePlaceOrder = async () => {
        if (userCart.length === 0) {
            showToast("error", "", "Cart is empty!");
            return;
        }

        if (paymentMethod === "cod") {
            handleOrderSuccess();
        } else {
            try {
                const res = await loadRazorpayScript("https://razorpay.me/@paymentgateway3299");
                if (!res) throw new Error("Razorpay SDK failed to load!");

                const finalBillAmount = (finalBill * 100).toString(); // in paisa
                const { data } = await axios.post("https://razorpay.me/@paymentgateway3299", { finalBillAmount });

                const options = {
                    key: "rzp_test_hyc3ht0ngvqOD5",
                    amount: data.amount,
                    currency: data.currency,
                    name: "Bookztron",
                    description: "Thank you for shopping!",
                    image: "https://raw.githubusercontent.com/Naman-Saxena1/Bookztron-E-Commerce_Book_Store/development/public/favicon-icon.png",
                    order_id: data.id,
                    handler: () => handleOrderSuccess(data.id)
                };

                const paymentObject = new window.Razorpay(options);
                paymentObject.open();
            } catch (error) {
                showToast("error", "", error.message || "Something went wrong during payment.");
            }
        }
    };

    return (
        <div className="cart-bill">
            <h2 className="bill-heading">Bill Details</h2>
            <hr />

            {userCart.map(product => (
                <div key={product._id} className="cart-price-container">
                    <p>{product.bookName}</p>
                    <p>X {product.quantity}</p>
                    <p id="price-sum">&#8377;{product.discountedPrice * product.quantity}</p>
                </div>
            ))}

            <hr />

            <div className="cart-discount-container">
                <p>Discount</p>
                <p id="price-sum">&#8377; {totalDiscount}</p>
            </div>

            <div className="cart-delivery-charges-container">
                <p>Delivery Charges</p>
                <p id="delivery-charges">&#8377; {DELIVERY_CHARGE}</p>
            </div>

            <hr />

            <div className="cart-total-charges-container">
                <p><b>Total Charges</b></p>
                <p id="total-charges"><b>&#8377; {finalBill}</b></p>
            </div>

            <hr />

            <div className="apply-coupon-container">
                <p>Apply Coupon</p>
                <input
                    value={couponName}
                    onChange={(e) => setCouponName(e.target.value)}
                    placeholder="Try BOOKS200"
                />
            </div>

            <div className="payment-method-container">
                <p><b>Select Payment Method</b></p>
                <label>
                    <input
                        type="radio"
                        name="payment"
                        value="online"
                        checked={paymentMethod === "online"}
                        onChange={() => setPaymentMethod("online")}
                    /> Online Payment
                </label>
                <label>
                    <input
                        type="radio"
                        name="payment"
                        value="cod"
                        checked={paymentMethod === "cod"}
                        onChange={() => setPaymentMethod("cod")}
                    /> Cash on Delivery
                </label>
            </div>

            <button
                className="place-order-btn solid-secondary-btn"
                onClick={handlePlaceOrder}
            >
                {paymentMethod === "cod" ? "Place Order (COD)" : "Pay & Place Order"}
            </button>
        </div>
    );
}

export { ShoppingBill };
