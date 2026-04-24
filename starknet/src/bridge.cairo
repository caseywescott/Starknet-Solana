//! KojiBridge — outbound bridge config + send path.
//! This keeps LayerZero endpoint wiring generic so we can swap in a concrete endpoint
//! contract address per deployment environment.

#[starknet::interface]
pub trait ILayerZeroEndpoint<TContractState> {
    fn lz_send(
        ref self: TContractState,
        dst_eid: u32,
        dst_peer: felt252,
        payload: Span<felt252>,
    );
    fn quote(
        self: @TContractState,
        dst_eid: u32,
        dst_peer: felt252,
        payload: Span<felt252>,
    ) -> MessagingFee;
}

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
    fn set_endpoint(ref self: TContractState, endpoint: starknet::ContractAddress);
    fn get_endpoint(self: @TContractState) -> starknet::ContractAddress;
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

#[derive(Drop, starknet::Event)]
pub struct BridgeMintSent {
    pub composition_id: u256,
    pub dst_eid: u32,
    pub dst_peer: felt252,
}

#[starknet::contract]
pub mod KojiBridge {
    use super::{
        BridgeMintRequested,
        BridgeMintSent,
        DestinationConfig,
        IKojiBridge,
        ILayerZeroEndpointDispatcher,
        ILayerZeroEndpointDispatcherTrait,
        MessagingFee,
    };
    use core::traits::TryInto;
    use starknet::get_caller_address;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        owner: starknet::ContractAddress,
        endpoint: starknet::ContractAddress,
        dst_eid: u32,
        dst_peer: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        BridgeMintRequested: BridgeMintRequested,
        BridgeMintSent: BridgeMintSent,
        DestinationUpdated: DestinationUpdated,
        EndpointUpdated: EndpointUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DestinationUpdated {
        pub dst_eid: u32,
        pub dst_peer: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EndpointUpdated {
        pub endpoint: starknet::ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        endpoint: starknet::ContractAddress,
        dst_eid: u32,
        dst_peer: felt252,
    ) {
        self.owner.write(get_caller_address());
        self.endpoint.write(endpoint);
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
            let endpoint = self.endpoint.read();
            let zero_addr: starknet::ContractAddress = 0_felt252.try_into().unwrap();
            assert!(cfg.dst_eid != 0_u32, "bridge not configured");
            assert!(cfg.dst_peer != 0, "bridge not configured");
            assert!(endpoint != zero_addr, "endpoint not configured");

            let mut payload: Array<felt252> = array![];
            payload.append(composition_id.low.into());
            payload.append(composition_id.high.into());
            payload.append(composer_solana);
            payload.append(seed.low.into());
            payload.append(seed.high.into());
            payload.append(scale.into());
            payload.append(rhythm_density.into());
            payload.append(bpm.into());

            let mut lz = ILayerZeroEndpointDispatcher { contract_address: endpoint };
            lz.lz_send(cfg.dst_eid, cfg.dst_peer, payload.span());

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
            self.emit(BridgeMintSent { composition_id, dst_eid: cfg.dst_eid, dst_peer: cfg.dst_peer });
        }

        fn quote_send(
            self: @ContractState,
            composition_id: u256,
        ) -> MessagingFee {
            let cfg = self.get_destination();
            let endpoint = self.endpoint.read();
            let zero_addr: starknet::ContractAddress = 0_felt252.try_into().unwrap();
            if cfg.dst_eid == 0_u32 {
                return MessagingFee { native_fee: 0_u128, lz_token_fee: 0_u128 };
            };
            if endpoint == zero_addr {
                return MessagingFee { native_fee: 0_u128, lz_token_fee: 0_u128 };
            };

            let mut payload: Array<felt252> = array![];
            payload.append(composition_id.low.into());
            payload.append(composition_id.high.into());
            payload.append(0); // composer_solana placeholder for quote
            payload.append(0); // seed.low placeholder
            payload.append(0); // seed.high placeholder
            payload.append(0); // scale placeholder
            payload.append(0); // rhythm_density placeholder
            payload.append(0); // bpm placeholder

            let lz = ILayerZeroEndpointDispatcher { contract_address: endpoint };
            lz.quote(cfg.dst_eid, cfg.dst_peer, payload.span())
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

        fn set_endpoint(ref self: ContractState, endpoint: starknet::ContractAddress) {
            assert!(get_caller_address() == self.owner.read(), "only owner");
            self.endpoint.write(endpoint);
            self.emit(EndpointUpdated { endpoint });
        }

        fn get_endpoint(self: @ContractState) -> starknet::ContractAddress {
            self.endpoint.read()
        }
    }
}
