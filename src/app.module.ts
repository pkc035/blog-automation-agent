import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RdbModule } from './rdb/rdb.module';
import { MongoModule } from './mongo/mongo.module';

@Module({
  imports: [RdbModule, MongoModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
