import { Controller, Post, Headers, type RawBodyRequest, Req, HttpCode, HttpStatus } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { Request } from "express";
import { Resilience } from "@nestjs/resilience";
import { RESILIENCE_PRESET } from "../config/resilience.config";

@Controller("payment")
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) {}

    @Post("webhook")
    @Resilience(RESILIENCE_PRESET.STRIPE)
    @HttpCode(HttpStatus.OK)
    handleWebhook(@Headers("stripe-signature") signature: string, @Req() request: RawBodyRequest<Request>) {
        this.paymentService.parseWebhook(signature, request.rawBody!);
        return { received: true };
    }
}
