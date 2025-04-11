import logging
import os
import requests
from datetime import datetime
from io import BytesIO

from sqlalchemy import select
from sqlalchemy.orm import joinedload
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto, LabeledPrice, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    PreCheckoutQueryHandler,
    filters,
)

from models.database import get_db
import models

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

TOKEN = os.getenv("TELEGRAM_TOKEN")
BASE_IMAGE_URL = os.getenv("BASE_IMAGE_URL", "http://localhost:8000/static/")
BASE_FLOWER_URL = os.getenv("BASE_FLOWER_URL", "http://127.0.0.1:3000/catalog.html?flower_id=")
DEBUG_MODE = os.getenv("DEBUG_MODE", "True").lower() in ("true", "1", "yes")
OWNER_IDS = [int(id.strip()) for id in os.getenv("OWNER_IDS", "5078575051,5078575052").split(",")]

if not TOKEN:
    raise ValueError("TELEGRAM_TOKEN не указан в переменных окружения!")

def buy_keyboard() -> InlineKeyboardMarkup:
    """Создание клавиатуры для оплаты."""
    keyboard = [[InlineKeyboardButton("💳 Оплатить через Telegram Stars", callback_data="pay")]]
    if DEBUG_MODE:
        keyboard.append([InlineKeyboardButton("🛠 Тестовая оплата (Debug)", callback_data="debug_pay")])
    return InlineKeyboardMarkup(keyboard)

def confirm_quantity_keyboard(cart_item_id: int, available_quantity: int) -> InlineKeyboardMarkup:
    """Создание клавиатуры подтверждения при недостатке товара."""
    keyboard = [
        [
            InlineKeyboardButton(
                f"✅ Оформить {available_quantity} шт.",
                callback_data=f"confirm_{cart_item_id}_{available_quantity}",
            )
        ],
        [InlineKeyboardButton("❌ Отменить", callback_data="cancel")],
    ]
    return InlineKeyboardMarkup(keyboard)

def download_image(url: str) -> BytesIO | None:
    """Скачивание изображения по URL."""
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return BytesIO(response.content)
        logger.error(f"Не удалось скачать изображение: {url}, статус: {response.status_code}")
        return None
    except Exception as e:
        logger.error(f"Ошибка при скачивании изображения {url}: {e}")
        return None

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start с параметром user_id."""
    user_id = context.args[0] if context.args else None
    if not user_id:
        await update.message.reply_text("Пожалуйста, используйте QR-код для оплаты.")
        return

    try:
        user_id = int(user_id)
    except ValueError:
        await update.message.reply_text("❌ Ошибка: user_id должен быть числом.")
        return

    async for db in get_db():
        result = await db.execute(
            select(models.CartItem)
            .options(joinedload(models.CartItem.flower).joinedload(models.Flower.images))
            .where(models.CartItem.user_id == user_id)
        )
        cart_items = result.unique().scalars().all()

        if not cart_items:
            await update.message.reply_text("🛒 Ваша корзина пуста.")
            return

        total_price = 0
        cart_details = f"🛒 <b>Ваша корзина (ID: {user_id})</b> 🛒\n\n"
        media: list[InputMediaPhoto] = []

        for item in cart_items:
            flower = item.flower
            item_total = flower.price * item.quantity
            total_price += item_total

            cart_details += (
                f"🌸 <b>{flower.name}</b>\n"
                f"  📌 Категория: {flower.category}\n"
                f"  📏 Размер: {flower.size}\n"
                f"  🔢 Количество: {item.quantity} шт.\n"
                f"  💰 Цена за шт: {flower.price} RUB\n"
                f"  🏷️ Итого: {item_total} RUB\n"
                f"  🔗 <a href='{BASE_FLOWER_URL}{flower.id}'>Подробнее</a>\n"
                "----------------------------------------\n"
            )

            if flower.images:
                image_path = flower.images[0].image_path
                image_url = f"{BASE_IMAGE_URL}{image_path}"
                image_file = download_image(image_url)
                if image_file:
                    media.append(InputMediaPhoto(media=image_file, caption=flower.name))
                else:
                    logger.warning(f"Не удалось загрузить изображение для {flower.name}")

        total_stars = int(total_price / 10)
        cart_details += (
            f"💵 <b>Общая сумма:</b> {total_price} RUB ({total_stars} Stars)\n"
            "----------------------------------------\n"
            "👇 Нажмите ниже, чтобы оплатить:"
        )

        if media:
            try:
                await context.bot.send_media_group(chat_id=update.message.chat_id, media=media)
            except Exception as e:
                logger.error(f"Ошибка при отправке медиа-группы: {e}")
                await update.message.reply_text(
                    "⚠️ Не удалось отправить изображения, но вы можете продолжить оплату."
                )

        await update.message.reply_text(
            cart_details,
            parse_mode="HTML",
            reply_markup=buy_keyboard(),
            disable_web_page_preview=True,
        )
        context.user_data["user_id"] = user_id
        context.user_data["cart_items"] = cart_items

async def notify_owners(
    context: ContextTypes.DEFAULT_TYPE, user_id: int, cart_items: list[models.CartItem], order_id: str, debug: bool = False
) -> None:
    """Уведомление владельцев о новом заказе."""
    async for db in get_db():
        result = await db.execute(
            select(models.User)
            .options(joinedload(models.User.profile))
            .where(models.User.id == user_id)
        )
        user = result.scalars().first()
        profile = user.profile if user else None

        refreshed_cart_items = []
        for item in cart_items:
            cart_result = await db.execute(
                select(models.CartItem)
                .options(joinedload(models.CartItem.flower))
                .where(models.CartItem.id == item.id)
            )
            refreshed_item = cart_result.scalars().first()
            if refreshed_item:
                refreshed_cart_items.append(refreshed_item)

        order_details = (
            f"🔔 <b>Новый заказ #{order_id}</b> 🔔\n"
            f"{'🛠 Тестовый заказ (Debug)' if debug else '💳 Реальный заказ'}\n\n"
            f"👤 <b>От кого:</b> {user.name if user else 'Неизвестно'} (ID: {user_id})\n"
            f"📧 <b>Email:</b> {user.email if user else 'Нет данных'}\n"
            f"📍 <b>Адрес:</b> {profile.address if profile and profile.address else 'Не указан'}\n"
            f"📞 <b>Телефон:</b> {profile.phone if profile and profile.phone else 'Не указан'}\n"
            f"✈️ <b>Telegram:</b> {profile.telegram if profile and profile.telegram else 'Не указан'}\n\n"
            f"🛒 <b>Состав заказа:</b>\n"
        )

        total_price = 0
        for item in refreshed_cart_items:
            flower = item.flower
            item_total = flower.price * item.quantity
            total_price += item_total
            order_details += (
                f"🌸 {flower.name}\n"
                f"  🔢 Кол-во: {item.quantity} шт.\n"
                f"  💰 Цена: {item_total} RUB\n"
                "----------------------------------------\n"
            )

        total_stars = int(total_price / 10)
        order_details += (
            f"💵 <b>Итого:</b> {total_price} RUB ({total_stars} Stars)\n"
            f"📅 <b>Дата:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        )

        for owner_id in OWNER_IDS:
            try:
                await context.bot.send_message(chat_id=owner_id, text=order_details, parse_mode="HTML")
            except Exception as e:
                logger.error(f"Не удалось отправить уведомление владельцу {owner_id}: {e}")

async def notify_user(context: ContextTypes.DEFAULT_TYPE, user_id: int, order_id: str) -> None:
    """Уведомление пользователя об успешной оплате."""
    async for db in get_db():
        result = await db.execute(
            select(models.User)
            .options(joinedload(models.User.profile))
            .where(models.User.id == user_id)
        )
        user = result.scalars().first()
        if user and user.profile and user.profile.telegram:
            try:
                await context.bot.send_message(
                    chat_id=user.profile.telegram,
                    text=f"✅ Заказ #{order_id} оплачен. С вами свяжутся в скором времени.",
                    parse_mode="HTML",
                )
            except Exception as e:
                logger.error(f"Не удалось уведомить пользователя {user_id}: {e}")

async def check_quantity_and_pay(update: Update, context: ContextTypes.DEFAULT_TYPE, debug: bool = False) -> None:
    """Проверка количества товара и отправка инвойса (или обработка для debug)."""
    query = update.callback_query
    await query.answer()

    user_id = context.user_data.get("user_id")
    if not user_id or not isinstance(user_id, int):
        await query.message.reply_text("❌ Ошибка: пользователь не найден или некорректный ID.")
        return

    async for db in get_db():
        result = await db.execute(
            select(models.CartItem)
            .options(joinedload(models.CartItem.flower))
            .where(models.CartItem.user_id == user_id)
        )
        current_cart_items = result.unique().scalars().all()

        if not current_cart_items:
            await query.message.reply_text("🛒 Ваша корзина пуста.")
            return

        insufficient_items = []
        total_price = 0

        for item in current_cart_items:
            flower = item.flower
            if item.quantity > flower.quantity:
                insufficient_items.append((item, flower.quantity))
            else:
                total_price += flower.price * item.quantity

        if insufficient_items:
            for item, available_quantity in insufficient_items:
                flower = item.flower
                message = (
                    f"⚠️ <b>Недостаточно товара на складе</b> ⚠️\n\n"
                    f"🌸 <b>{flower.name}</b>\n"
                    f"🔢 В вашей корзине: {item.quantity} шт.\n"
                    f"📦 На складе: {available_quantity} шт.\n\n"
                    f"К сожалению, на складе осталось только {available_quantity} шт. этого товара, "
                    f"а у вас в корзине {item.quantity}. Если вы согласны, мы можем оформить заказ на {available_quantity} шт.\n\n"
                    f"👇 Выберите действие:"
                )
                await query.message.reply_text(
                    message,
                    parse_mode="HTML",
                    reply_markup=confirm_quantity_keyboard(item.id, available_quantity),
                )
            return

        order_id = f"{user_id}_{int(datetime.utcnow().timestamp())}"
        context.user_data["order_id"] = order_id
        context.user_data["cart_items"] = current_cart_items

        if debug:
            for item in current_cart_items:
                flower = item.flower
                purchase = models.Purchase(
                    user_id=user_id,
                    flower_id=flower.id,
                    quantity=item.quantity,
                    total_price=flower.price * item.quantity,
                    purchase_date=datetime.utcnow(),
                )
                db.add(purchase)
                flower.quantity -= item.quantity
                await db.delete(item)
            await db.commit()

            await notify_owners(context, user_id, current_cart_items, order_id, debug=True)
            await notify_user(context, user_id, order_id)
            await query.message.reply_text(
                f"🛠 <b>Тестовая оплата успешна (Debug Mode)!</b>\n"
                f"Заказ #{order_id} оплачен.\n"
                f"Покупки сохранены в истории, корзина очищена.\n"
                f"Спасибо за покупку! 🌟",
                parse_mode="HTML",
            )
        else:
            total_stars = int(total_price / 10)
            await context.bot.send_invoice(
                chat_id=query.message.chat_id,
                title=f"Оплата заказа #{order_id}",
                description="Покупка цветов из корзины",
                payload=f"cart_{user_id}",
                provider_token="",
                currency="XTR",
                prices=[LabeledPrice("Корзина", total_stars)],
            )

async def pay(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик кнопки оплаты."""
    await check_quantity_and_pay(update, context, debug=False)

async def debug_pay(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик тестовой оплаты (debug)."""
    await check_quantity_and_pay(update, context, debug=True)

async def confirm_quantity(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик подтверждения уменьшенного количества."""
    query = update.callback_query
    await query.answer()

    data = query.data.split("_")
    if data[0] == "confirm":
        cart_item_id = int(data[1])
        new_quantity = int(data[2])

        async for db in get_db():
            try:
                result = await db.execute(
                    select(models.CartItem)
                    .options(joinedload(models.CartItem.flower))
                    .where(models.CartItem.id == cart_item_id)
                )
                cart_item = result.scalars().first()

                if not cart_item:
                    await query.message.reply_text(
                        "❌ Ошибка: товар в корзине не найден.",
                        parse_mode="HTML",
                    )
                    return

                flower_name = cart_item.flower.name
                cart_item.quantity = new_quantity
                await db.commit()

                user_id = context.user_data.get("user_id")
                if not user_id or not isinstance(user_id, int):
                    await query.message.reply_text("❌ Ошибка: пользователь не найден.")
                    return

                result = await db.execute(
                    select(models.CartItem)
                    .options(joinedload(models.CartItem.flower))
                    .where(models.CartItem.user_id == user_id)
                )
                context.user_data["cart_items"] = result.unique().scalars().all()

                await query.message.reply_text(
                    f"✅ Количество обновлено! Теперь в корзине {new_quantity} шт. {flower_name}.\n"
                    f"Пожалуйста, повторите оплату.",
                    parse_mode="HTML",
                    reply_markup=buy_keyboard(),
                )
            except Exception as e:
                logger.error(f"Ошибка при обновлении количества: {e}")
                await query.message.reply_text(
                    "⚠️ Произошла ошибка при обновлении количества. Попробуйте позже.",
                    parse_mode="HTML",
                )
    elif query.data == "cancel":
        await query.message.reply_text("❌ Оформление заказа отменено.")

async def pre_checkout(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик предпроверки платежа."""
    query = update.pre_checkout_query
    await context.bot.answer_pre_checkout_query(query.id, ok=True)

async def process_payment(context: ContextTypes.DEFAULT_TYPE, user_id: int, cart_items: list[models.CartItem], order_id: str, debug: bool = False) -> None:
    """Обработка успешной оплаты: сохранение покупок, очистка корзины, уведомления."""
    async for db in get_db():
        refreshed_cart_items = []
        for item in cart_items:
            result = await db.execute(
                select(models.CartItem)
                .options(joinedload(models.CartItem.flower))
                .where(models.CartItem.id == item.id)
            )
            refreshed_item = result.scalars().first()
            if refreshed_item:
                refreshed_cart_items.append(refreshed_item)

        for item in refreshed_cart_items:
            flower = item.flower
            purchase = models.Purchase(
                user_id=user_id,
                flower_id=flower.id,
                quantity=item.quantity,
                total_price=flower.price * item.quantity,
                purchase_date=datetime.utcnow(),
            )
            db.add(purchase)
            flower.quantity -= item.quantity
            await db.delete(item)
        await db.commit()

        await notify_owners(context, user_id, refreshed_cart_items, order_id, debug)
        await notify_user(context, user_id, order_id)

async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик успешного платежа через Telegram Stars."""
    payment = update.message.successful_payment
    user_id = int(payment.invoice_payload.split("_")[1])
    order_id = context.user_data.get("order_id")
    cart_items = context.user_data.get("cart_items")

    if not order_id or not cart_items:
        await update.message.reply_text(
            "❌ Ошибка: данные заказа не найдены. Попробуйте начать заново с /start.",
            parse_mode="HTML",
        )
        return

    await process_payment(context, user_id, cart_items, order_id, debug=False)

    await update.message.reply_text(
        f"✅ <b>Оплата прошла успешно!</b>\n"
        f"Заказ #{order_id} оплачен.\n"
        f"Покупки сохранены в истории, корзина очищена.\n"
        f"С вами свяжутся в скором времени.\n"
        f"Спасибо за покупку! 🌟",
        parse_mode="HTML",
    )
    context.user_data.pop("cart_items", None)
    context.user_data.pop("order_id", None)

def main() -> None:
    """Запуск Telegram-бота."""
    try:
        application = Application.builder().token(TOKEN).build()

        application.add_handler(CommandHandler("start", start))
        application.add_handler(CallbackQueryHandler(pay, pattern="pay"))
        application.add_handler(CallbackQueryHandler(debug_pay, pattern="debug_pay"))
        application.add_handler(CallbackQueryHandler(confirm_quantity, pattern=r"^(confirm|cancel).*"))
        application.add_handler(PreCheckoutQueryHandler(pre_checkout))
        application.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))

        logger.info("Бот запускается...")
        application.run_polling()
    except Exception as e:
        logger.error(f"Ошибка при запуске бота: {e}")

if __name__ == "__main__":
    main()