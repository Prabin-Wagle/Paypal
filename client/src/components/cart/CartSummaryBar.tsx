import { ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { exactMoney } from "../../lib/format";

export function CartSummaryBar() {
  const { selected, count, total } = useCart();
  const navigate = useNavigate();

  if (count === 0) return null;

  return (
    <div className="cart-bar" role="region" aria-label="Cart summary">
      <div className="cart-bar-left">
        <div className="cart-bar-thumbs" aria-hidden="true">
          {selected.slice(0, 3).map((item) => (
            <img key={item.id} src={item.image_url} alt="" />
          ))}
        </div>
        <div className="cart-bar-copy">
          <strong>
            {count} verified item{count === 1 ? "" : "s"} selected
          </strong>
          <span>
            <ShieldCheck size={9} strokeWidth={2} />
            Server total {exactMoney(total)} · re-priced at checkout
          </span>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-sm cart-bar-btn"
        onClick={() => navigate("/cart")}
      >
        <ShoppingBag size={13} strokeWidth={2} />
        Review cart
        <ArrowRight size={13} strokeWidth={2} />
      </button>
    </div>
  );
}
