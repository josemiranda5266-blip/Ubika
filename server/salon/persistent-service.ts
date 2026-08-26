import { SalonService } from './service';
import { PersistentDiningOrderRepository, PersistentRestaurantTableRepository } from './persistent-repositories';

export function createPersistentSalonService(): SalonService {
  return new SalonService(
    new PersistentRestaurantTableRepository(),
    new PersistentDiningOrderRepository(),
  );
}
