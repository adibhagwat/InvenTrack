from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from . import models, schemas

LOW_STOCK_THRESHOLD = 10


# ============================================================
# Products
# ============================================================
def create_product(db: Session, product: schemas.ProductCreate) -> models.Product:
    existing = db.query(models.Product).filter(models.Product.sku == product.sku).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A product with SKU '{product.sku}' already exists",
        )
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


def get_products(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Product).offset(skip).limit(limit).all()


def get_product(db: Session, product_id: int) -> models.Product:
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found",
        )
    return product


def update_product(
    db: Session, product_id: int, updates: schemas.ProductUpdate
) -> models.Product:
    product = get_product(db, product_id)
    data = updates.model_dump(exclude_unset=True)

    if "sku" in data and data["sku"] != product.sku:
        clash = db.query(models.Product).filter(models.Product.sku == data["sku"]).first()
        if clash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A product with SKU '{data['sku']}' already exists",
            )

    for key, value in data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> None:
    product = get_product(db, product_id)
    db.delete(product)
    db.commit()


# ============================================================
# Customers
# ============================================================
def create_customer(db: Session, customer: schemas.CustomerCreate) -> models.Customer:
    existing = db.query(models.Customer).filter(models.Customer.email == customer.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A customer with email '{customer.email}' already exists",
        )
    db_customer = models.Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


def get_customers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Customer).offset(skip).limit(limit).all()


def get_customer(db: Session, customer_id: int) -> models.Customer:
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with id {customer_id} not found",
        )
    return customer


def delete_customer(db: Session, customer_id: int) -> None:
    customer = get_customer(db, customer_id)
    db.delete(customer)
    db.commit()


# ============================================================
# Orders
# ============================================================
def create_order(db: Session, order: schemas.OrderCreate) -> models.Order:
    if not order.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An order must contain at least one item",
        )

    # Make sure the customer exists
    customer = get_customer(db, order.customer_id)

    # Validate every product + stock level BEFORE touching anything,
    # so a failure never leaves a partially-applied order.
    products_by_id = {}
    for item in order.items:
        product = (
            db.query(models.Product).filter(models.Product.id == item.product_id).first()
        )
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with id {item.product_id} not found",
            )
        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for '{product.name}' "
                    f"(available: {product.stock_quantity}, requested: {item.quantity})"
                ),
            )
        products_by_id[item.product_id] = product

    total_amount = sum(
        products_by_id[item.product_id].price * item.quantity for item in order.items
    )

    db_order = models.Order(
        customer_id=customer.id, total_amount=total_amount, status="completed"
    )
    db.add(db_order)
    db.flush()  # assigns db_order.id without committing yet

    for item in order.items:
        product = products_by_id[item.product_id]
        db.add(
            models.OrderItem(
                order_id=db_order.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=product.price,
            )
        )
        product.stock_quantity -= item.quantity  # automatic stock reduction

    db.commit()
    db.refresh(db_order)
    return db_order


def get_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Order).offset(skip).limit(limit).all()


def get_order(db: Session, order_id: int) -> models.Order:
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    return order


def delete_order(db: Session, order_id: int) -> None:
    """Cancel/delete an order and restore the stock it had reserved."""
    order = get_order(db, order_id)
    for item in order.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if product:
            product.stock_quantity += item.quantity
    db.delete(order)
    db.commit()


# ============================================================
# Dashboard
# ============================================================
def get_dashboard_stats(db: Session) -> schemas.DashboardResponse:
    total_products = db.query(models.Product).count()
    total_customers = db.query(models.Customer).count()
    total_orders = db.query(models.Order).count()
    low_stock = (
        db.query(models.Product)
        .filter(models.Product.stock_quantity < LOW_STOCK_THRESHOLD)
        .all()
    )
    return schemas.DashboardResponse(
        total_products=total_products,
        total_customers=total_customers,
        total_orders=total_orders,
        low_stock_products=low_stock,
    )
