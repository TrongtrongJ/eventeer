import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';

@Module({
  imports: [CircuitBreakerModule],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
