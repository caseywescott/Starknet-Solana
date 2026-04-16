//! KojiBridge — outbound bridge config + stub relay event.
//! LayerZero send path is not wired yet; this contract now tracks destination config and
//! exposes quote/config entrypoints expected by PRD §5.3.

#[starknet::interface]
pub trait IKojiBridge<TContractState> {
    fn send_mint_to_solana(
        ref self: TContractState,
        composition_id: u256,
        composer_solana: felt252,
        seed: u256,
        scale: u8,
        rhythm_density: u8,
        bpm: u16,
    );
    fn quote_send(
        self: @TContractState,
        composition_id: u256,
    ) -> MessagingFee;
    fn set_destination(
        ref self: TContractState,
        dst_eid: u32,
        dst_peer: felt252,
    );
    fn get_destination(self: @TContractState) -> DestinationConfig;
}

#[derive(Copy, Drop, Serde)]
pub struct MessagingFee {
    pub native_fee: u128,
    pub lz_token_fee: u128,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct DestinationConfig {
    pub dst_eid: u32,
    pub dst_peer: felt252,
}

#[derive(Drop, starknet::Event)]
pub struct BridgeMintRequested {
    pub composition_id: u256,
    pub composer_solana: felt252,
    pub seed: u256,
    pub scale: u8,
    pub rhythm_density: u8,
    pub bpm: u16,
}

#[starknet::contract]
pub mod KojiBridge {
    use super::{BridgeMintRequested, DestinationConfig, IKojiBridge, MessagingFee};
    use starknet::get_caller_address;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        owner: starknet::ContractAddress,
        dst_eid: u32,
        dst_peer: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        BridgeMintRequested: BridgeMintRequested,
        DestinationUpdated: DestinationUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DestinationUpdated {
        pub dst_eid: u32,
        pub dst_peer: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, dst_eid: u32, dst_peer: felt252) {
        self.owner.write(get_caller_address());
        self.dst_eid.write(dst_eid);
        self.dst_peer.write(dst_peer);
    }

    #[abi(embed_v0)]
    impl KojiBridgeImpl of IKojiBridge<ContractState> {
        fn send_mint_to_solana(
            ref self: ContractState,
            composition_id: u256,
            composer_solana: felt252,
            seed: u256,
            scale: u8,
            rhythm_density: u8,
            bpm: u16,
        ) {
            let cfg = self.get_destination();
            assert!(cfg.dst_eid != 0_u32, "bridge not configured");
            assert!(cfg.dst_peer != 0, "bridge not configured");
            self
                .emit(
                    BridgeMintRequested {
                        composition_id,
                        composer_solana,
                        seed,
                        scale,
                        rhythm_density,
                        bpm,
                    },
                );
        }

        fn quote_send(
            self: @ContractState,
            composition_id: u256,
        ) -> MessagingFee {
            let _ = composition_id;
            let cfg = self.get_destination();
            if cfg.dst_eid == 0_u32 {
                return MessagingFee { native_fee: 0_u128, lz_token_fee: 0_u128 };
            };

            // Stub quote until LayerZero endpoint wiring is complete.
            MessagingFee { native_fee: 10_000_000_000_000_000_u128, lz_token_fee: 0_u128 }
        }

        fn set_destination(
            ref self: ContractState,
            dst_eid: u32,
            dst_peer: felt252,
        ) {
            assert!(get_caller_address() == self.owner.read(), "only owner");
            self.dst_eid.write(dst_eid);
            self.dst_peer.write(dst_peer);
            self.emit(DestinationUpdated { dst_eid, dst_peer });
        }

        fn get_destination(self: @ContractState) -> DestinationConfig {
            DestinationConfig {
                dst_eid: self.dst_eid.read(),
                dst_peer: self.dst_peer.read(),
            }
        }
    }
}
