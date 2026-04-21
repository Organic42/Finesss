import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('transactions')
@Index(['userId', 'date'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, default: 'default_user' })
  userId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  income: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  expense: number;

  @CreateDateColumn()
  createdAt: Date;
}
