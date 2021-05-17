const paymentKeys = require("../config/payment");
const stripe = require("stripe")(paymentKeys.SECRET_KEY);
const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");



exports.pay = async (req, res) => {

    const patient = await Payment.findOne({ patientId: req.body.patientId });
    console.log(patient);
    if (patient) {
        const customer = await stripe.customers.retrieve(patient.customerId);
        if (customer) {
            createPayment(req, res, patient.customerId);
        }

    } else {
        stripe.customers.create({
            name: req.body.name,
            email: req.body.email
        })
            .then(customer => createPayment(req, res, customer.id))
            .catch(err => res.send("err2"));
    }

}


const calculatedPrice = (price) => {
    return price * 100;
}

const createPayment = async (req, res, cusId) => {
    const appointment = await Appointment.findOne({ _id: req.body.appointmentId });
    const price = appointment.price;
    stripe.paymentIntents.create({
        amount: calculatedPrice(price),
        currency: 'mad',
        payment_method_types: ['card'],
        customer: cusId,
        receipt_email: "moadup@gmail.com"
    })
        .then(payment => {
            stripe.paymentIntents.confirm(
                payment.id,
                { payment_method: 'pm_card_visa' }
            )
                .then(payment => {
                    const savedPayment = Payment({
                        doctorId: req.body.doctorId,
                        patientId: req.body.patientId,
                        customerId: cusId,
                        appointmenId: req.body.appointmenId,
                        amount: req.body.amount,
                        description: req.body.description
                    });
                    savedPayment.save();
                    res.send(payment)
                })
                .catch(err => res.send(err));
        })
        .catch(() => res.send("err1"))
}


exports.getPaymentById = (req, res) => {
    Payment.findOne({ _id: req.body.paymentId })
        .then(payment => res.status(200).json(payment))
        .catch(() => res.status(404).json({ error: "Transaction Not Found" }));
}


exports.getPayments = (req, res) => {
    Payment.find({})
        .then(payments => res.status(200).json(payments))
        .then(err => res.status(500).json(err));
}