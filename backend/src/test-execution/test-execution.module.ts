import { Module } from '@nestjs/common';
import { TestExecutionController } from './test-execution.controller';
import { TestExecutionService } from './test-execution.service';
import { TestExecutionExcelService } from './test-execution-excel.service';

@Module({
  controllers: [TestExecutionController],
  providers: [TestExecutionService, TestExecutionExcelService],
  exports: [TestExecutionService],
})
export class TestExecutionModule {}
